import { buildLinkPhysics, solveLinkFlow, G } from "./hydraulics.js";
import { solveDense } from "./linalg.js";
import type {
  LinkResult,
  NodeResult,
  Project,
  SolveResult,
  Status,
} from "./types.js";

/**
 * Steady incompressible Flow Network Modeling solver.
 *
 * Uses a nodal Newton method on piezometric head (Global Gradient style):
 * each link flow is an implicit function of the head difference across it,
 * and nodal mass continuity is driven to zero with a weighted-Laplacian
 * Jacobian solved by a dense LU each iteration.
 */
export function solveSteady(project: Project): SolveResult {
  const t0 = now();
  const warnings: string[] = [];
  const conv = project.analysis?.convergence ?? {};
  const maxIter = conv.maxIter ?? 100;
  const tol = conv.massResidual ?? 1e-8;
  const relax = conv.relaxationP ?? 1.0;
  const gravity = project.analysis?.gravity !== false;
  const rho = project.fluid.rho;

  const nodes = project.nodes;
  const links = project.links;
  const nodeIndex = new Map<string, number>();
  nodes.forEach((n, i) => nodeIndex.set(n.id, i));

  const gz = (i: number): number =>
    gravity ? rho * G * (nodes[i].z ?? 0) : 0;

  // Fixed piezometric head (Pa) for boundary nodes; undefined for unknowns.
  const isFixed = nodes.map(
    (n) => n.pFixed !== undefined && (n.kind === "boundary" || n.kind === "tank"),
  );
  const H = nodes.map((n, i) =>
    isFixed[i] ? (n.pFixed as number) + gz(i) : 0,
  );

  // Initialise unknown heads to the mean of fixed heads for a good start.
  const fixedHeads = H.filter((_, i) => isFixed[i]);
  const seed =
    fixedHeads.length > 0
      ? fixedHeads.reduce((a, b) => a + b, 0) / fixedHeads.length
      : 0;
  nodes.forEach((_, i) => {
    if (!isFixed[i]) H[i] = seed;
  });

  const physics = links.map((l) =>
    buildLinkPhysics(l.component, project.fluid),
  );

  const unknown: number[] = [];
  nodes.forEach((_, i) => {
    if (!isFixed[i]) unknown.push(i);
  });
  const unknownPos = new Map<number, number>();
  unknown.forEach((nodeI, k) => unknownPos.set(nodeI, k));

  const residuals: number[] = [];
  let status: Status = "converged";
  let iterations = 0;

  const linkFlow = new Array(links.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    // Evaluate link flows and slopes from current heads.
    const gp = new Array(links.length).fill(0);
    for (let e = 0; e < links.length; e++) {
      const a = nodeIndex.get(links[e].from)!;
      const b = nodeIndex.get(links[e].to)!;
      const dh = H[a] - H[b];
      const q = solveLinkFlow(physics[e], dh);
      linkFlow[e] = q;
      gp[e] = 1 / physics[e].dHeadloss(q);
    }

    const m = unknown.length;
    if (m === 0) {
      residuals.push(0);
      break;
    }

    // Assemble F (continuity imbalance) and K (weighted Laplacian).
    const F = new Array(m).fill(0);
    const K: number[][] = Array.from({ length: m }, () =>
      new Array(m).fill(0),
    );
    for (let e = 0; e < links.length; e++) {
      const a = nodeIndex.get(links[e].from)!;
      const b = nodeIndex.get(links[e].to)!;
      const q = linkFlow[e];
      const w = gp[e];
      const ka = unknownPos.get(a);
      const kb = unknownPos.get(b);
      if (ka !== undefined) {
        F[ka] -= q; // flow leaves 'from'
        K[ka][ka] += w;
      }
      if (kb !== undefined) {
        F[kb] += q; // flow enters 'to'
        K[kb][kb] += w;
      }
      if (ka !== undefined && kb !== undefined) {
        K[ka][kb] -= w;
        K[kb][ka] -= w;
      }
    }
    // Subtract external demands.
    for (let k = 0; k < m; k++) {
      F[k] -= nodes[unknown[k]].demand ?? 0;
    }

    const resid = Math.max(...F.map((v) => Math.abs(v)));
    residuals.push(resid);
    if (resid < tol) {
      status = "converged";
      break;
    }

    const dH = solveDense(K, F);
    if (!dH) {
      status = "singular";
      warnings.push("Jacobian is singular; check that the network is connected to a pressure boundary.");
      break;
    }

    let maxRel = 0;
    for (let k = 0; k < m; k++) {
      H[unknown[k]] += relax * dH[k];
      maxRel = Math.max(maxRel, Math.abs(dH[k]));
    }

    if (!Number.isFinite(maxRel)) {
      status = "diverged";
      warnings.push("Solution diverged.");
      break;
    }
    if (iter === maxIter - 1) {
      status = "max-iter";
      warnings.push(`Reached maxIter (${maxIter}) without meeting tolerance.`);
    }
  }

  // Build results.
  const nodeResults: Record<string, NodeResult> = {};
  nodes.forEach((n, i) => {
    nodeResults[n.id] = {
      H: H[i],
      P: H[i] - gz(i),
      T: n.tFixed,
    };
  });

  const linkResults: Record<string, LinkResult> = {};
  links.forEach((l, e) => {
    const q = linkFlow[e];
    const phys = physics[e];
    const v = q / phys.area;
    const re = phys.reynolds(q);
    // dP across the resistance excludes the pump rise.
    const pumpRise = phys.pumpRise(q);
    const dP = phys.headloss(q) + pumpRise; // headloss() already subtracted pump
    linkResults[l.id] = {
      Q: q,
      mdot: q * rho,
      dP,
      V: v,
      Re: re,
      f: l.component.type === "pipe" ? phys.frictionFactor(q) : undefined,
      pumpRise: pumpRise !== 0 ? pumpRise : undefined,
    };
  });

  return {
    status,
    iterations,
    residuals,
    nodes: nodeResults,
    links: linkResults,
    warnings,
    elapsedMs: now() - t0,
  };
}

function now(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf && typeof perf.now === "function") {
    return perf.now();
  }
  return Date.now();
}

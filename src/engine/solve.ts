import { solveLinear } from "./linalg";
import { dDp_dQ, linkDeltaP } from "./constitutive";
import { hexHeat, epsilonNtu } from "./thermo";
import { areaFromD } from "./friction";
import { teeLegDrops, type TeeLegFlow } from "./tee";
import type {
  CouplingResult,
  Fluid,
  HexCoupling,
  LinkDef,
  LinkResult,
  NodeDef,
  NodeResult,
  Project,
  SolveResult,
} from "./types";

interface TeeJunction {
  /** Incident link indices; legs[i] and sign[i] belong to links[i]. */
  links: number[];
  legs: TeeLegFlow[];
  /** +1 when the link points into the node, −1 when it leaves it. */
  sign: number[];
  rho: number;
}

interface Network {
  project: Project;
  nodeIndex: Map<string, number>;
  nodes: NodeDef[];
  links: LinkDef[];
  fluids: Record<string, Fluid>;
  freeNodes: number[];
  fixedP: Map<string, number>;
  gravity: boolean;
  tees: TeeJunction[];
}

function linkArea(link: LinkDef): number {
  const g = link.component.geometry;
  const A = g.A ?? (g.D > 0 ? areaFromD(g.D) : 0);
  return A * Math.max(1, link.component.parallelCount ?? 1);
}

function assembleTees(project: Project): TeeJunction[] {
  const tees: TeeJunction[] = [];
  for (const node of project.nodes) {
    if (!node.tee) continue;
    if (node.kind !== "junction") {
      throw new Error(`Node ${node.id}: tee needs a junction node`);
    }
    const links: number[] = [];
    project.links.forEach((l, k) => {
      if (l.from === node.id || l.to === node.id) links.push(k);
    });
    if (links.length < 2 || links.length > 3) {
      throw new Error(`Node ${node.id}: tee needs 2 or 3 incident links, has ${links.length}`);
    }
    const branchId = node.tee.branch;
    if (!links.some((k) => project.links[k].id === branchId)) {
      throw new Error(`Node ${node.id}: tee branch ${branchId} is not an incident link`);
    }
    const legs: TeeLegFlow[] = links.map((k) => ({
      into: 0,
      area: linkArea(project.links[k]),
      role: project.links[k].id === branchId ? "branch" : "run",
    }));
    if (legs.some((leg) => !(leg.area > 0))) {
      throw new Error(`Node ${node.id}: tee legs need a flow area (D or geometry.A)`);
    }
    const runs = legs.filter((leg) => leg.role === "run");
    if (runs.length === 2 && Math.abs(runs[0].area - runs[1].area) > 1e-6 * runs[0].area) {
      throw new Error(`Node ${node.id}: tee run legs need equal areas`);
    }
    const fluid = project.fluids[node.fluid];
    if (!fluid) throw new Error(`Missing fluid ${node.fluid}`);
    tees.push({
      links,
      legs,
      sign: links.map((k) => (project.links[k].to === node.id ? 1 : -1)),
      rho: fluid.rho,
    });
  }
  return tees;
}

/** Static drop along each link's own flow direction from tee junctions at its ends. */
function teeDropsByLink(net: Network, Q: number[]): number[] {
  const drop = new Array<number>(net.links.length).fill(0);
  for (const t of net.tees) {
    t.links.forEach((k, i) => {
      t.legs[i].into = t.sign[i] * Q[k];
    });
    const d = teeLegDrops(t.legs, t.rho);
    t.links.forEach((k, i) => {
      drop[k] += d[i];
    });
  }
  return drop;
}

function flowDir(Q: number): number {
  return Q >= 0 ? 1 : -1;
}

/** Central-difference ∂(tee drop on link i)/∂Q_j for every leg pair of every junction. */
function addTeeJacobian(net: Network, Q: number[], J: number[][], col0: number): void {
  for (const t of net.tees) {
    t.links.forEach((k, i) => {
      t.legs[i].into = t.sign[i] * Q[k];
    });
    t.links.forEach((kj, j) => {
      const h = Math.max(1e-9, 1e-6 * Math.abs(Q[kj]));
      const into = t.legs[j].into;
      t.legs[j].into = into + h;
      const plus = teeLegDrops(t.legs, t.rho);
      t.legs[j].into = into - h;
      const minus = teeLegDrops(t.legs, t.rho);
      t.legs[j].into = into;
      t.links.forEach((ki, i) => {
        const dDrop = (t.sign[j] * (plus[i] - minus[i])) / (2 * h);
        J[ki][col0 + kj] -= flowDir(Q[ki]) * dDrop;
      });
    });
  }
}

function assemble(project: Project): Network {
  const nodes = project.nodes;
  const nodeIndex = new Map<string, number>();
  nodes.forEach((n, i) => nodeIndex.set(n.id, i));
  for (const l of project.links) {
    if (!nodeIndex.has(l.from) || !nodeIndex.has(l.to)) {
      throw new Error(`Link ${l.id} references a missing node`);
    }
  }
  const fixedP = new Map<string, number>();
  for (const n of nodes) {
    if (n.kind === "boundary" || n.kind === "tank") {
      if (n.pFixed === undefined) {
        throw new Error(`Node ${n.id} (${n.kind}) needs pFixed`);
      }
      fixedP.set(n.id, n.pFixed);
    }
  }
  if (fixedP.size === 0) {
    throw new Error("Network needs at least one pressure-boundary / tank node");
  }
  const freeNodes: number[] = [];
  nodes.forEach((n, i) => {
    if (!fixedP.has(n.id)) freeNodes.push(i);
  });
  return {
    project,
    nodeIndex,
    nodes,
    links: project.links,
    fluids: project.fluids,
    freeNodes,
    fixedP,
    gravity: project.analysis.gravity,
    tees: assembleTees(project),
  };
}

function fluidOf(net: Network, id: string): Fluid {
  const f = net.fluids[id];
  if (!f) throw new Error(`Missing fluid ${id}`);
  return f;
}

function nodeMap(net: Network): Record<string, NodeDef> {
  const m: Record<string, NodeDef> = {};
  for (const n of net.nodes) m[n.id] = n;
  return m;
}

function initState(net: Network): { P: number[]; Q: number[] } {
  const P = net.nodes.map((n) => {
    const fix = net.fixedP.get(n.id);
    if (fix !== undefined) return fix;
    return 101325 + (net.gravity ? 995 * 9.80665 * n.z : 0);
  });
  const Q = net.links.map((l) => {
    const D = l.component.geometry.D || 0.02;
    const V = fluidOf(net, l.fluid).phase === "gas" ? 3 : 1;
    return V * areaFromD(D) * Math.max(1, l.component.parallelCount ?? 1);
  });
  return { P, Q };
}

function pressureOf(net: Network, P: number[], id: string): number {
  const fix = net.fixedP.get(id);
  if (fix !== undefined) return fix;
  return P[net.nodeIndex.get(id)!];
}

/**
 * Newton–Raphson on {P_free, Q_links}.
 *
 * Link residual:  P_from − P_to − Δp(Q) − (tee drops at either end) = 0
 * Node residual:  Σ Q_in − Σ Q_out + mdot_source/ρ = 0
 * A node with `tee` holds the static pressure of the tee's common channel.
 */
function solveHydraulics(net: Network): {
  P: number[];
  Q: number[];
  iterations: number;
  residuals: number[];
  status: SolveResult["status"];
} {
  const { P, Q } = initState(net);
  const conv = net.project.analysis.convergence;
  const nFree = net.freeNodes.length;
  const nL = net.links.length;
  const n = nFree + nL;
  const residuals: number[] = [];
  const nodesById = nodeMap(net);
  let status: SolveResult["status"] = "max-iter";
  let lastR = Infinity;

  const Qref = Math.max(
    1e-6,
    Q.reduce((s, q) => s + Math.abs(q), 0) / Math.max(1, Q.length),
  );

  for (let iter = 0; iter < conv.maxIter; iter++) {
    const r = new Array<number>(n).fill(0);
    const J = Array.from({ length: n }, () => new Array<number>(n).fill(0));

    const colP = (nodeIdx: number): number | null => {
      const pos = net.freeNodes.indexOf(nodeIdx);
      return pos >= 0 ? pos : null;
    };

    // Link momentum residuals
    const teeDrop = teeDropsByLink(net, Q);
    for (let k = 0; k < nL; k++) {
      const link = net.links[k];
      const fluid = fluidOf(net, link.fluid);
      const Pf = pressureOf(net, P, link.from);
      const Pt = pressureOf(net, P, link.to);
      const evald = linkDeltaP(link, Q[k], fluid, nodesById, net.gravity);
      const row = k;
      r[row] = Pf - Pt - evald.dP - flowDir(Q[k]) * teeDrop[k];
      const a = dDp_dQ(link, Q[k], fluid, nodesById, net.gravity);
      J[row][nFree + k] = -a;
      const iFrom = net.nodeIndex.get(link.from)!;
      const iTo = net.nodeIndex.get(link.to)!;
      const cF = colP(iFrom);
      const cT = colP(iTo);
      if (cF !== null) J[row][cF] += 1;
      if (cT !== null) J[row][cT] -= 1;
    }
    addTeeJacobian(net, Q, J, nFree);

    // Nodal continuity for free nodes (volumetric, incompressible, per-fluid density)
    for (let fi = 0; fi < nFree; fi++) {
      const ni = net.freeNodes[fi];
      const node = net.nodes[ni];
      const fluid = fluidOf(net, node.fluid);
      const row = nL + fi;
      let sumQ = 0;
      if (node.mdotSource) sumQ += node.mdotSource / fluid.rho;
      for (let k = 0; k < nL; k++) {
        const link = net.links[k];
        if (link.to === node.id) {
          sumQ += Q[k];
          J[row][nFree + k] += 1;
        }
        if (link.from === node.id) {
          sumQ -= Q[k];
          J[row][nFree + k] -= 1;
        }
      }
      r[row] = sumQ;
    }

    let rMass = 0;
    let rMom = 0;
    for (let k = 0; k < nL; k++) rMom = Math.max(rMom, Math.abs(r[k]));
    for (let i = nL; i < n; i++) rMass = Math.max(rMass, Math.abs(r[i]));
    const rNorm = Math.max(rMass / Qref, rMom / 1e5);
    residuals.push(rNorm);

    if (rMass < conv.massResidual && rMom < Math.max(1e-4, conv.massResidual * 1e8)) {
      status = "converged";
      return { P, Q, iterations: iter + 1, residuals, status };
    }

    let dx: number[];
    try {
      dx = solveLinear(J, r.map((v) => -v));
    } catch {
      status = "singular";
      return { P, Q, iterations: iter + 1, residuals, status };
    }

    const alpha0 = iter < 4 ? Math.min(conv.relaxationQ, 0.5) : conv.relaxationP;
    let alpha = alpha0;
    if (rNorm > lastR * 1.4) alpha *= 0.4;
    lastR = rNorm;

    for (let fi = 0; fi < nFree; fi++) {
      P[net.freeNodes[fi]] += alpha * dx[fi];
    }
    for (let k = 0; k < nL; k++) {
      Q[k] += alpha * dx[nFree + k];
    }
  }

  if (residuals.length && residuals[residuals.length - 1] < 1e-4) {
    status = "converged";
  }
  return { P, Q, iterations: conv.maxIter, residuals, status };
}

function upstream(link: LinkDef, Q: number): string {
  return Q >= 0 ? link.from : link.to;
}

function downstream(link: LinkDef, Q: number): string {
  return Q >= 0 ? link.to : link.from;
}

function solveEnergy(
  net: Network,
  Q: number[],
): {
  T: number[];
  linkQheat: number[];
  couplings: Record<string, CouplingResult>;
  energyResidual: number;
  energyIterations: number;
} {
  const nN = net.nodes.length;
  const T = net.nodes.map((n) => {
    if (n.tFixed !== undefined) return n.tFixed;
    return fluidOf(net, n.fluid).phase === "gas" ? 298.15 : 303.15;
  });
  const linkQheat = net.links.map((l) => l.component.q ?? 0);
  const couplings: Record<string, CouplingResult> = {};

  if (!net.project.analysis.energy) {
    return { T, linkQheat, couplings, energyResidual: 0, energyIterations: 0 };
  }

  const hexByLink = new Map<string, { role: "hot" | "cold"; coupling: HexCoupling; U: number }>();
  for (const c of net.project.couplings) {
    const hot = net.links.find((l) => l.id === c.hotLinkId);
    const cold = net.links.find((l) => l.id === c.coldLinkId);
    if (!hot || !cold) throw new Error(`HEX ${c.id} is missing a stream link`);
    const hi = net.links.indexOf(hot);
    const ci = net.links.indexOf(cold);
    const fH = fluidOf(net, hot.fluid);
    const fC = fluidOf(net, cold.fluid);
    const C_hot = fH.rho * Math.abs(Q[hi]) * fH.cp;
    const C_cold = fC.rho * Math.abs(Q[ci]) * fC.cp;
    const ntu = epsilonNtu({
      UA: c.ua,
      C_hot,
      C_cold,
      arrangement: c.arrangement,
    });
    const U = ntu.effectiveness * ntu.Cmin;
    hexByLink.set(hot.id, { role: "hot", coupling: c, U });
    hexByLink.set(cold.id, { role: "cold", coupling: c, U });
  }

  const free: number[] = [];
  net.nodes.forEach((n, i) => {
    if (n.tFixed === undefined) free.push(i);
  });
  const colOf = new Array<number>(nN).fill(-1);
  free.forEach((ni, c) => {
    colOf[ni] = c;
  });
  const nF = free.length;
  const A = Array.from({ length: nF }, () => new Array<number>(nF).fill(0));
  const b = new Array<number>(nF).fill(0);

  const add = (row: number, nodeIdx: number, coeff: number) => {
    const col = colOf[nodeIdx];
    if (col >= 0) A[row][col] += coeff;
    else b[row] -= coeff * T[nodeIdx];
  };

  for (let fi = 0; fi < nF; fi++) {
    const ni = free[fi];
    const node = net.nodes[ni];
    let incoming = 0;

    for (let k = 0; k < net.links.length; k++) {
      const link = net.links[k];
      if (downstream(link, Q[k]) !== node.id) continue;
      const fluid = fluidOf(net, link.fluid);
      const absM = fluid.rho * Math.abs(Q[k]);
      if (absM < 1e-15) continue;
      incoming += 1;
      const mCp = absM * fluid.cp;
      const upi = net.nodeIndex.get(upstream(link, Q[k]))!;
      const hex = hexByLink.get(link.id);
      add(fi, ni, mCp);
      if (hex) {
        const hot = net.links.find((l) => l.id === hex.coupling.hotLinkId)!;
        const cold = net.links.find((l) => l.id === hex.coupling.coldLinkId)!;
        const hi = net.links.indexOf(hot);
        const ci = net.links.indexOf(cold);
        const iH = net.nodeIndex.get(upstream(hot, Q[hi]))!;
        const iC = net.nodeIndex.get(upstream(cold, Q[ci]))!;
        if (hex.role === "hot") {
          add(fi, upi, -mCp);
          add(fi, iH, hex.U);
          add(fi, iC, -hex.U);
        } else {
          add(fi, upi, -mCp);
          add(fi, iH, -hex.U);
          add(fi, iC, hex.U);
        }
      } else {
        add(fi, upi, -mCp);
        b[fi] += link.component.q ?? 0;
      }
    }

    b[fi] += node.qSource ?? 0;
    if (incoming === 0) {
      A[fi][fi] = 1;
      b[fi] = T[ni];
    }
  }

  let energyResidual = 0;
  if (nF > 0) {
    const x = solveLinear(A, b);
    for (let fi = 0; fi < nF; fi++) T[free[fi]] = x[fi];
    const Ax = A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));
    energyResidual = Ax.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
  }

  for (const c of net.project.couplings) {
    const hx = evalHex(net, c, Q, T);
    couplings[c.id] = hx;
    const hi = net.links.findIndex((l) => l.id === c.hotLinkId);
    const ci = net.links.findIndex((l) => l.id === c.coldLinkId);
    linkQheat[hi] = -hx.q;
    linkQheat[ci] = hx.q;
  }

  return { T, linkQheat, couplings, energyResidual, energyIterations: 1 };
}

function evalHex(
  net: Network,
  c: HexCoupling,
  Q: number[],
  T: number[],
): CouplingResult {
  const hot = net.links.find((l) => l.id === c.hotLinkId);
  const cold = net.links.find((l) => l.id === c.coldLinkId);
  if (!hot || !cold) throw new Error(`HEX ${c.id} is missing a stream link`);
  const hi = net.links.indexOf(hot);
  const ci = net.links.indexOf(cold);
  const fH = fluidOf(net, hot.fluid);
  const fC = fluidOf(net, cold.fluid);
  const C_hot = fH.rho * Math.abs(Q[hi]) * fH.cp;
  const C_cold = fC.rho * Math.abs(Q[ci]) * fC.cp;
  const T_hot_in = T[net.nodeIndex.get(upstream(hot, Q[hi]))!];
  const T_cold_in = T[net.nodeIndex.get(upstream(cold, Q[ci]))!];
  const hx = hexHeat({
    UA: c.ua,
    C_hot,
    C_cold,
    T_hot_in,
    T_cold_in,
    arrangement: c.arrangement,
  });
  return {
    q: hx.q,
    effectiveness: hx.effectiveness,
    ntu: hx.ntu,
    Cmin: hx.Cmin,
    Cr: hx.Cr,
    T_hot_in,
    T_hot_out: hx.T_hot_out,
    T_cold_in,
    T_cold_out: hx.T_cold_out,
  };
}

export function solveSteady(project: Project): SolveResult {
  const t0 = performance.now?.() ?? Date.now();
  const warnings: string[] = [];
  const net = assemble(project);
  const hyd = solveHydraulics(net);
  if (hyd.status === "singular") warnings.push("Hydraulic Jacobian was singular.");
  if (hyd.status === "max-iter") warnings.push("Hydraulics hit max iterations.");

  const energy = solveEnergy(net, hyd.Q);

  const nodes: Record<string, NodeResult> = {};
  for (let i = 0; i < net.nodes.length; i++) {
    nodes[net.nodes[i].id] = { P: hyd.P[i], T: energy.T[i] };
  }

  const links: Record<string, LinkResult> = {};
  const nodesById = nodeMap(net);
  const teeDrop = teeDropsByLink(net, hyd.Q);
  for (let k = 0; k < net.links.length; k++) {
    const link = net.links[k];
    const fluid = fluidOf(net, link.fluid);
    const ev = linkDeltaP(link, hyd.Q[k], fluid, nodesById, net.gravity);
    const mdot = fluid.rho * hyd.Q[k];
    const T_in = energy.T[net.nodeIndex.get(upstream(link, hyd.Q[k]))!];
    const absM = Math.abs(mdot);
    const T_out =
      absM > 1e-15
        ? T_in + energy.linkQheat[k] / (absM * fluid.cp)
        : T_in;
    const q = energy.linkQheat[k];
    let T_surface: number | undefined;
    if (link.component.rTh !== undefined) {
      const Tmean = 0.5 * (T_in + T_out);
      T_surface = Tmean + (link.component.q ?? 0) * link.component.rTh;
    }
    links[link.id] = {
      Q: hyd.Q[k],
      mdot,
      dP: ev.dP + flowDir(hyd.Q[k]) * teeDrop[k],
      V: ev.V,
      Re: ev.Re,
      f: ev.f,
      q,
      T_in,
      T_out,
      T_surface,
    };
  }

  // Closed-loop energy check
  if (project.analysis.energy) {
    let qIn = 0;
    let qHex = 0;
    for (const l of project.links) {
      if ((l.component.q ?? 0) !== 0) qIn += l.component.q ?? 0;
    }
    for (const c of Object.values(energy.couplings)) qHex += c.q;
    const mismatch = Math.abs(qIn - qHex);
    if (qIn !== 0 && mismatch / Math.abs(qIn) > 1e-3) {
      warnings.push(
        `Energy mismatch: sources ${qIn.toFixed(2)} W vs HEX ${qHex.toFixed(2)} W`,
      );
    }
  }

  const t1 = performance.now?.() ?? Date.now();
  return {
    status: hyd.status,
    iterations: hyd.iterations,
    energyIterations: energy.energyIterations,
    residuals: hyd.residuals,
    energyResidual: energy.energyResidual,
    nodes,
    links,
    couplings: energy.couplings,
    warnings,
    elapsedMs: t1 - t0,
  };
}

export function massImbalance(
  project: Project,
  result: SolveResult,
): Record<string, number> {
  const imb: Record<string, number> = {};
  for (const n of project.nodes) {
    if (n.kind !== "junction") continue;
    const rho = project.fluids[n.fluid]?.rho ?? 1;
    let s = (n.mdotSource ?? 0) / rho;
    for (const l of project.links) {
      const Q = result.links[l.id].Q;
      if (l.to === n.id) s += Q;
      if (l.from === n.id) s -= Q;
    }
    imb[n.id] = s;
  }
  return imb;
}

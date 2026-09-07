import type { Project } from "../types";
import { solveSteady } from "../solve";
import { GPM } from "../units";

const PSI = 6894.757;

/** Published MF11 Table 1 LCM operating point (FNM design). */
export const MF11_LCM = {
  Q_gpm: 0.12,
  dP_psig: 3.5,
};

/**
 * MF11-style composite component (VERIFICATION I6 / R10 pattern).
 * Solve a small parallel orifice subnetwork, tabulate Δp(Q), replace with a
 * curve component, and require parent Q within 1% of the expanded network.
 */
export function mf11ExpandedBlock(): Project {
  const nodes: Project["nodes"] = [
    {
      id: "a",
      kind: "boundary",
      x: 0,
      y: 0,
      z: 0,
      fluid: "water-20C",
      pFixed: 150000,
      tFixed: 293.15,
    },
    {
      id: "b",
      kind: "boundary",
      x: 100,
      y: 0,
      z: 0,
      fluid: "water-20C",
      pFixed: 101325,
      tFixed: 293.15,
    },
  ];
  const links: Project["links"] = [];
  for (let i = 0; i < 3; i++) {
    links.push({
      id: `leg-${i + 1}`,
      from: "a",
      to: "b",
      fluid: "water-20C",
      component: {
        type: "orifice",
        lossModel: "k-factor",
        geometry: { L: 0, D: 0.01, eps: 0 },
        K: 2 + i,
      },
    });
  }
  return baseProject("MF11 expanded LCM block", nodes, links);
}

export function sampleDeltaPCurve(
  project: Project,
  pressures: number[],
): { Q: number; dP: number }[] {
  const curve: { Q: number; dP: number }[] = [];
  for (const p of pressures) {
    const trial: Project = {
      ...project,
      nodes: project.nodes.map((n) =>
        n.id === "a" ? { ...n, pFixed: p } : n,
      ),
    };
    const r = solveSteady(trial);
    if (r.status !== "converged") throw new Error(`sample failed at P=${p}`);
    const Q = Object.values(r.links).reduce((s, l) => s + l.Q, 0);
    curve.push({ Q, dP: p - 101325 });
  }
  return curve.sort((a, b) => a.Q - b.Q);
}

export function mf11CompositeFromCurve(
  curve: { Q: number; dP: number }[],
): Project {
  return baseProject(
    "MF11 composite curve component",
    [
      {
        id: "a",
        kind: "boundary",
        x: 0,
        y: 0,
        z: 0,
        fluid: "water-20C",
        pFixed: 150000,
        tFixed: 293.15,
      },
      {
        id: "b",
        kind: "boundary",
        x: 100,
        y: 0,
        z: 0,
        fluid: "water-20C",
        pFixed: 101325,
        tFixed: 293.15,
      },
    ],
    [
      {
        id: "composite",
        from: "a",
        to: "b",
        fluid: "water-20C",
        component: {
          type: "generic-resistance",
          lossModel: "quadratic",
          geometry: { L: 0, D: 0.02, eps: 0 },
          K: 0,
          rQuad: fitRQuad(curve),
        },
      },
    ],
  );
}

/**
 * Reconstructible LCM golden through the published Table 1 point.
 * Quadratic ΔP = r Q|Q| is pinned exactly at (0.12 gpm, 3.50 psig); the
 * hierarchy then stacks identical LCMs in parallel (row / system).
 */
export function mf11LcmRQuad(): number {
  const Q = MF11_LCM.Q_gpm * GPM;
  const dP = MF11_LCM.dP_psig * PSI;
  return dP / (Q * Math.abs(Q));
}

export function mf11LcmAtPublishedPoint(): Project {
  return lcmProject(1, MF11_LCM.dP_psig * PSI, "MF11 single LCM at Table 1 point");
}

export function mf11Hierarchy(
  level: "lcm" | "row" | "system",
): { project: Project; nParallel: number; paperQ_gpm: number; paperDp_psig: number } {
  // Table 1 ratios: 3.40/0.12 ≈ 28.333; 13.60/0.12 ≈ 113.333; 13.60/3.40 = 4 rows.
  const n = level === "lcm" ? 1 : level === "row" ? 28 : 113;
  const paper =
    level === "lcm"
      ? { Q: 0.12, dP: 3.5 }
      : level === "row"
        ? { Q: 3.4, dP: 3.0 }
        : { Q: 13.6, dP: 2.0 };
  // Drive with the published LCM ΔP so each element sits on its curve;
  // row/system paper ΔP differ (manifold) — comparison records that gap.
  return {
    project: lcmProject(n, MF11_LCM.dP_psig * PSI, `MF11 ${level} ×${n} LCM`),
    nParallel: n,
    paperQ_gpm: paper.Q,
    paperDp_psig: paper.dP,
  };
}

function lcmProject(nParallel: number, dP: number, name: string): Project {
  return baseProject(
    name,
    [
      {
        id: "a",
        kind: "boundary",
        x: 0,
        y: 0,
        z: 0,
        fluid: "water-20C",
        pFixed: 101325 + dP,
        tFixed: 293.15,
      },
      {
        id: "b",
        kind: "boundary",
        x: 100,
        y: 0,
        z: 0,
        fluid: "water-20C",
        pFixed: 101325,
        tFixed: 293.15,
      },
    ],
    [
      {
        id: "lcm",
        from: "a",
        to: "b",
        fluid: "water-20C",
        component: {
          type: "generic-resistance",
          lossModel: "quadratic",
          geometry: { L: 0, D: 0.01, eps: 0 },
          K: 0,
          rQuad: mf11LcmRQuad(),
          parallelCount: nParallel,
        },
      },
    ],
  );
}

function fitRQuad(curve: { Q: number; dP: number }[]): number {
  let num = 0;
  let den = 0;
  for (const p of curve) {
    const q2 = p.Q * Math.abs(p.Q);
    num += p.dP * q2;
    den += q2 * q2;
  }
  return num / Math.max(den, 1e-30);
}

function baseProject(
  name: string,
  nodes: Project["nodes"],
  links: Project["links"],
): Project {
  return {
    version: "0.1.0",
    meta: {
      name,
      description: "MF11 hierarchical curve reuse / Table 1 LCM golden",
      createdAt: "2026-09-07T00:00:00Z",
      updatedAt: "2026-09-07T00:00:00Z",
    },
    units: {
      system: "SI",
      length: "m",
      pressure: "Pa",
      flow: "m3/s",
      temperature: "K",
      power: "W",
    },
    fluids: {
      "water-20C": {
        id: "water-20C",
        name: "Water 20 °C",
        phase: "liquid",
        rho: 998.2,
        mu: 0.001002,
        cp: 4182,
        k: 0.598,
        beta: 0.000207,
        Tref: 293.15,
      },
    },
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy: false,
      gravity: false,
      convergence: {
        massResidual: 1e-10,
        energyResidual: 1e-8,
        maxIter: 200,
        relaxationP: 0.7,
        relaxationQ: 0.7,
      },
    },
    nodes,
    links,
    couplings: [],
  };
}

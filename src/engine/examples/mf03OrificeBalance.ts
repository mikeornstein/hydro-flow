import type { Project } from "../types";

const GPM = 6.30901964e-5;

/** EU heat loads from MF03 Table 1 (kW). */
export const MF03_LOADS_KW = [0.3, 0.4, 0.5, 3.0, 4.0] as const;
export const MF03_T_LIMIT_C = 60;

/**
 * MF03 five-branch orifice balance (flow-only or energy slice of Fig 6).
 * Fixed 6.8 gpm through five parallel cold-plate branches with branch orifices.
 * Identical orifices → uneven Q (header geometry). Tuned orifice K pulls flow
 * toward the high-load branches (EU-4/5).
 *
 * Energy mode uses fixed rTh (K/W), not Lytron Rth(Q) curves. rTh is chosen so
 * equal-share flow at Tin=25 °C puts EU-5 near the 60 °C limit; orifice tuning
 * then pulls high-load branches below the limit. Absolute T is illustrative.
 */
export function mf03OrificeBalance(
  mode: "identical" | "tuned",
  opts: { energy?: boolean } = {},
): Project {
  const energy = opts.energy ?? false;
  const Q = 6.8 * GPM;
  const rho = 997.0;
  const mdot = rho * Q;
  const IN = 0.0254;
  const headerD = 0.75 * IN;
  const branchD = 0.5 * IN;
  const eps = 1.5e-6;
  const Tin = 25 + 273.15;
  const rTh = [0.035, 0.03, 0.025, 0.0082, 0.0076];

  const orificeK =
    mode === "identical"
      ? [2, 2, 2, 2, 2]
      : [28, 22, 16, 0.5, 0.25];

  const nodes: Project["nodes"] = [
    {
      id: "inlet",
      kind: "junction",
      x: 0,
      y: 0,
      z: 0,
      fluid: "water-25C",
      mdotSource: mdot,
      ...(energy ? { tFixed: Tin } : {}),
    },
    {
      id: "outlet",
      kind: "boundary",
      x: 0,
      y: 120,
      z: 0,
      fluid: "water-25C",
      pFixed: 101325,
      tFixed: Tin,
    },
  ];
  const links: Project["links"] = [];

  for (let i = 0; i < 5; i++) {
    nodes.push({
      id: `J${i}`,
      kind: "junction",
      x: 40 + i * 50,
      y: 0,
      z: 0,
      fluid: "water-25C",
    });
    nodes.push({
      id: `O${i}`,
      kind: "junction",
      x: 40 + i * 50,
      y: 60,
      z: 0,
      fluid: "water-25C",
    });
  }

  links.push({
    id: "in-J0",
    from: "inlet",
    to: "J0",
    fluid: "water-25C",
    component: {
      type: "pipe",
      lossModel: "darcy-weisbach",
      geometry: { L: 0.05, D: headerD, eps },
      K: 0.5,
    },
  });
  for (let i = 0; i < 4; i++) {
    links.push({
      id: `hdr-${i}`,
      from: `J${i}`,
      to: `J${i + 1}`,
      fluid: "water-25C",
      component: {
        type: "pipe",
        lossModel: "darcy-weisbach",
        geometry: { L: 0.2, D: headerD, eps },
        K: 0,
      },
    });
  }
  for (let i = 0; i < 5; i++) {
    links.push({
      id: `orifice-${i + 1}`,
      from: `J${i}`,
      to: `O${i}`,
      fluid: "water-25C",
      component: {
        type: "orifice",
        lossModel: "k-factor",
        geometry: { L: 0, D: branchD * 0.6, eps: 0 },
        K: orificeK[i],
      },
    });
    links.push({
      id: `plate-${i + 1}`,
      from: `O${i}`,
      to: "outlet",
      fluid: "water-25C",
      component: {
        type: "cold-plate",
        lossModel: "darcy-weisbach",
        geometry: { L: 0.3, D: branchD, eps },
        K: 2,
        ...(energy
          ? { q: MF03_LOADS_KW[i] * 1000, rTh: rTh[i] }
          : {}),
      },
    });
  }

  return {
    version: "0.1.0",
    meta: {
      name: `MF03 orifice balance (${mode}${energy ? "+energy" : ""})`,
      description: energy
        ? "Five-branch orifice sizing with fixed rTh energy path (no Lytron Rth(Q) scrape)."
        : "Five-branch U-style manifold at 6.8 gpm. Flow-only orifice sizing vs load weights.",
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
      "water-25C": {
        id: "water-25C",
        name: "Water 25 °C",
        phase: "liquid",
        rho: 997.0,
        mu: 0.00089,
        cp: 4181,
        k: 0.607,
        beta: 0.000257,
        Tref: 298.15,
      },
    },
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy,
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

export function branchShares(
  links: Record<string, { Q: number }>,
): number[] {
  const qs = [1, 2, 3, 4, 5].map((i) => links[`plate-${i}`].Q);
  const sum = qs.reduce((a, b) => a + b, 0);
  return qs.map((q) => q / sum);
}

export { GPM };

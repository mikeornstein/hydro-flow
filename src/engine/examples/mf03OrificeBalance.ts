import type { Project } from "../types";

const GPM = 6.30901964e-5;

/**
 * MF03 five-branch orifice balance (flow-only slice of Fig 6).
 * Fixed 6.8 gpm through five parallel cold-plate branches with branch orifices.
 * Identical orifices → uneven Q (header geometry). Tuned orifice K pulls flow
 * toward the high-load branches (EU-4/5). Energy/T targets need cold-plate Rth
 * and are deferred (no Lytron catalog scrape).
 */
export function mf03OrificeBalance(mode: "identical" | "tuned"): Project {
  const Q = 6.8 * GPM;
  const rho = 998.2;
  const mdot = rho * Q;
  const IN = 0.0254;
  const headerD = 0.75 * IN;
  const branchD = 0.5 * IN;
  const eps = 1.5e-6;
  // Loads 0.3/0.4/0.5/3.0/4.0 kW → relative cooling demand weights
  const weights = [0.3, 0.4, 0.5, 3.0, 4.0];
  const wSum = weights.reduce((a, b) => a + b, 0);
  const targetShare = weights.map((w) => w / wSum);

  // Identical: same orifice K. Tuned: K larger on low-demand branches.
  const orificeK =
    mode === "identical"
      ? [2, 2, 2, 2, 2]
      : [12, 10, 8, 1.2, 0.8];

  const nodes: Project["nodes"] = [
    {
      id: "inlet",
      kind: "junction",
      x: 0,
      y: 0,
      z: 0,
      fluid: "water-20C",
      mdotSource: mdot,
    },
    {
      id: "outlet",
      kind: "boundary",
      x: 0,
      y: 120,
      z: 0,
      fluid: "water-20C",
      pFixed: 101325,
      tFixed: 293.15,
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
      fluid: "water-20C",
    });
    nodes.push({
      id: `O${i}`,
      kind: "junction",
      x: 40 + i * 50,
      y: 60,
      z: 0,
      fluid: "water-20C",
    });
  }

  links.push({
    id: "in-J0",
    from: "inlet",
    to: "J0",
    fluid: "water-20C",
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
      fluid: "water-20C",
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
      fluid: "water-20C",
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
      fluid: "water-20C",
      component: {
        type: "cold-plate",
        lossModel: "darcy-weisbach",
        geometry: { L: 0.3, D: branchD, eps },
        K: 2,
      },
    });
  }

  return {
    version: "0.1.0",
    meta: {
      name: `MF03 orifice balance (${mode})`,
      description:
        "Five-branch U-style manifold at 6.8 gpm. Flow-only orifice sizing vs load weights; thermal Rth deferred.",
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

export function branchShares(
  links: Record<string, { Q: number }>,
): number[] {
  const qs = [1, 2, 3, 4, 5].map((i) => links[`plate-${i}`].Q);
  const sum = qs.reduce((a, b) => a + b, 0);
  return qs.map((q) => q / sum);
}

export { GPM };

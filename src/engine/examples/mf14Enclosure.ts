import type { Project } from "../types";

const CFM = 1 / 2118.8799727597;
const IN = 0.0254;
const IN_H2O = 249.08891;

/**
 * MF14 electronics enclosure toward published FNM total 65.8 CFM.
 * Published: 2 fans @ 0.24 inH2O / 45 CFM each; EMI 51% open, 0.31" holes;
 * 13 PCBs at 0.8" pitch; 17° inlet ramp; bypass at last card.
 *
 * Card passage Δp(Q) from CFD is unpublished. Passages use handbook Darcy +
 * screen K on documented open area — not an rQuad fit to 65.8. Depth into
 * the page is assumed 8 in (documented).
 */
export function mf14Enclosure(): Project {
  const nPcb = 13;
  const nPass = nPcb - 1; // passages between adjacent PCBs
  const pitch = 0.8 * IN;
  const depth = 8 * IN;
  const passH = 6 * IN;
  const gap = pitch * 0.7; // card thickness takes ~30% of pitch
  const aPass = gap * depth;
  const dhPass = (2 * gap * depth) / (gap + depth);
  const sigma = 0.51;
  const Kemi = 1 / (sigma * sigma) - 1;
  const qMax = 45 * CFM;
  const dpMax = 0.24 * IN_H2O;
  const eps = 1.5e-4;

  const nodes: Project["nodes"] = [
    {
      id: "ambient",
      kind: "boundary",
      x: 0,
      y: 0,
      z: 0,
      fluid: "air-25C",
      pFixed: 101325,
      tFixed: 298.15,
    },
    {
      id: "after-inlet",
      kind: "junction",
      x: 40,
      y: 0,
      z: 0,
      fluid: "air-25C",
    },
    {
      id: "before-fans",
      kind: "junction",
      x: 200,
      y: 80,
      z: 0,
      fluid: "air-25C",
    },
    {
      id: "exit",
      kind: "boundary",
      x: 280,
      y: 80,
      z: 0,
      fluid: "air-25C",
      pFixed: 101325,
      tFixed: 298.15,
    },
  ];
  const links: Project["links"] = [
    {
      id: "inlet-emi",
      name: "Inlet EMI 51% open",
      from: "ambient",
      to: "after-inlet",
      fluid: "air-25C",
      component: {
        type: "orifice",
        lossModel: "k-factor",
        // Open area ≈ nPass * pitch * depth * sigma (order-of-magnitude face)
        geometry: {
          L: 0,
          D: 0.31 * IN,
          eps: 0,
          A: nPass * pitch * depth * sigma,
        },
        K: Kemi,
      },
    },
  ];

  for (let i = 0; i < nPass; i++) {
    links.push({
      id: `pass-${i + 1}`,
      name: `Card passage ${i + 1}`,
      from: "after-inlet",
      to: "before-fans",
      fluid: "air-25C",
      component: {
        type: "duct",
        lossModel: "darcy-weisbach",
        geometry: { L: passH, D: dhPass, eps, A: aPass },
        K: 2.5,
      },
    });
  }
  // Bypass between last card and wall (~0.5 pitch gap)
  const aBypass = 0.5 * pitch * depth;
  const dhBypass = (2 * 0.5 * pitch * depth) / (0.5 * pitch + depth);
  links.push({
    id: "bypass",
    name: "End-wall bypass",
    from: "after-inlet",
    to: "before-fans",
    fluid: "air-25C",
    component: {
      type: "duct",
      lossModel: "darcy-weisbach",
      geometry: { L: passH, D: dhBypass, eps, A: aBypass },
      K: 1.5,
    },
  });

  for (const side of ["L", "R"] as const) {
    links.push({
      id: `fan-${side}`,
      name: `Axial fan ${side}`,
      from: "before-fans",
      to: "exit",
      fluid: "air-25C",
      component: {
        type: "fan",
        lossModel: "k-factor",
        geometry: { L: 0.05, D: 0.08, eps: 0 },
        K: Kemi * 0.5 + 0.5,
        fan: {
          coeffs: [dpMax, 0, -dpMax / (qMax * qMax)],
          dpMin: 0,
        },
      },
    });
  }

  return {
    version: "0.1.0",
    meta: {
      name: "MF14 enclosure FNM (handbook impedance)",
      description:
        "MF14 toward published 65.8 CFM total. Synthetic fan endpoints + EMI K; card Δp from Darcy not CFD table.",
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
      "air-25C": {
        id: "air-25C",
        name: "Air 25 °C",
        phase: "gas",
        rho: 1.2,
        mu: 1.85e-5,
        cp: 1007,
        k: 0.026,
        beta: 0.0033,
        Tref: 298.15,
      },
    },
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy: false,
      gravity: false,
      convergence: {
        massResidual: 1e-9,
        energyResidual: 1e-8,
        maxIter: 250,
        relaxationP: 0.65,
        relaxationQ: 0.65,
      },
    },
    nodes,
    links,
    couplings: [],
  };
}

export function mf14TotalCfm(solved: {
  links: Record<string, { Q: number }>;
}): number {
  return (solved.links["fan-L"].Q + solved.links["fan-R"].Q) * (1 / CFM);
}

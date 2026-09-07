import type { Project } from "../types";

const CFM = 1 / 2118.8799727597;
const IN_H2O = 249.08891;

/**
 * MF01 multiplicity pattern (Electronics Cooling 1999).
 * Table 2 fans are clean: Main 0.15 inH2O / 66 SCFM; PSU 0.28 / 74 SCFM.
 * Table 1 prints B in Pa/(m³/s)²; OCR decades (1e-4 … 5e-6) give ΔP ≪ fan
 * shutoff at SCFM-scale Q, so they are NOT used as rQuad (see mf01-table1.json).
 * Card stack uses parallelCount=4 as the published multiplier; branch K values
 * are documented placeholders for the multiplicity lever only.
 */
export function mf01MultiplicityChassis(): Project {
  const main = { dpMax: 0.15 * IN_H2O, qMax: 66 * CFM };
  const psu = { dpMax: 0.28 * IN_H2O, qMax: 74 * CFM };

  return {
    version: "0.1.0",
    meta: {
      name: "MF01 multiplicity chassis pattern",
      description:
        "MF01 Table 2 fans + parallelCount=4 card stack. Table 1 OCR B decades physically inconsistent with fan head — placeholders only.",
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
        maxIter: 200,
        relaxationP: 0.7,
        relaxationQ: 0.7,
      },
    },
    nodes: [
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
        id: "plenum",
        kind: "junction",
        x: 100,
        y: 0,
        z: 0,
        fluid: "air-25C",
      },
      {
        id: "exit",
        kind: "boundary",
        x: 200,
        y: 0,
        z: 0,
        fluid: "air-25C",
        pFixed: 101325,
        tFixed: 298.15,
      },
    ],
    links: [
      {
        id: "dasd",
        name: "DASD path (placeholder K)",
        from: "ambient",
        to: "plenum",
        fluid: "air-25C",
        component: {
          type: "duct",
          lossModel: "k-factor",
          geometry: { L: 0.1, D: 0.08, eps: 0 },
          K: 12,
        },
      },
      {
        id: "main-fan",
        name: "Main fan",
        from: "plenum",
        to: "exit",
        fluid: "air-25C",
        component: {
          type: "fan",
          lossModel: "k-factor",
          geometry: { L: 0.05, D: 0.1, eps: 0 },
          K: 1,
          fan: {
            coeffs: [main.dpMax, 0, -main.dpMax / (main.qMax * main.qMax)],
            dpMin: 0,
          },
        },
      },
      {
        id: "card-stack",
        name: "Memory/Processor cards ×4",
        from: "plenum",
        to: "exit",
        fluid: "air-25C",
        component: {
          type: "duct",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.2, D: 0.03, eps: 1e-4 },
          K: 4,
          parallelCount: 4,
        },
      },
      {
        id: "psu-fan",
        name: "Power supply fan",
        from: "ambient",
        to: "exit",
        fluid: "air-25C",
        component: {
          type: "fan",
          lossModel: "k-factor",
          geometry: { L: 0.08, D: 0.08, eps: 0 },
          K: 6,
          fan: {
            coeffs: [psu.dpMax, 0, -psu.dpMax / (psu.qMax * psu.qMax)],
            dpMin: 0,
          },
        },
      },
    ],
    couplings: [],
  };
}

/** Same topology with card stack expanded to four explicit links (no parallelCount). */
export function mf01ExpandedCardStack(): Project {
  const base = mf01MultiplicityChassis();
  const stack = base.links.find((l) => l.id === "card-stack")!;
  const links = base.links.filter((l) => l.id !== "card-stack");
  for (let i = 0; i < 4; i++) {
    links.push({
      ...stack,
      id: `card-${i + 1}`,
      name: `Card channel ${i + 1}`,
      component: {
        ...stack.component,
        parallelCount: 1,
      },
    });
  }
  return {
    ...base,
    meta: {
      ...base.meta,
      name: "MF01 expanded card stack (4 links)",
    },
    links,
  };
}

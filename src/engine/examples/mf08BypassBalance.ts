import type { Project } from "../types";

const CFM = 1 / 2118.8799727597;

/**
 * MF08 Case A/B qualitative bypass balance at fixed system flow.
 * Uses published Table 1 topology intents: processors ∥ CPU bypass, with
 * perforated-plate open area as a K knob. Fixed total flow avoids inventing
 * vendor fan curves; compares processor share A (100% open) vs B (36% open).
 *
 * K_perf roughly ~ (1/σ² - 1) order for open fraction σ (Idelchik screen form).
 */
export function mf08BypassBalance(
  bypassOpenFraction: number,
  totalCfm = 162,
): Project {
  const sigma = Math.min(0.999, Math.max(0.05, bypassOpenFraction));
  const Kperf = 1 / (sigma * sigma) - 1;
  const Q = totalCfm * CFM;
  const rho = 1.2;
  const mdot = rho * Q;

  return {
    version: "0.1.0",
    meta: {
      name: `MF08 bypass open=${(sigma * 100).toFixed(0)}%`,
      description:
        "MF08 processor ∥ bypass at fixed total CFM. Perforated plate K from open fraction; no vendor fan curves.",
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
        massResidual: 1e-10,
        energyResidual: 1e-8,
        maxIter: 200,
        relaxationP: 0.7,
        relaxationQ: 0.7,
      },
    },
    nodes: [
      {
        id: "inlet",
        kind: "junction",
        x: 0,
        y: 0,
        z: 0,
        fluid: "air-25C",
        mdotSource: mdot,
      },
      {
        id: "outlet",
        kind: "boundary",
        x: 120,
        y: 0,
        z: 0,
        fluid: "air-25C",
        pFixed: 101325,
        tFixed: 298.15,
      },
    ],
    links: [
      {
        id: "processors",
        name: "Processors x4",
        from: "inlet",
        to: "outlet",
        fluid: "air-25C",
        component: {
          type: "duct",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.15, D: 0.04, eps: 1e-4 },
          K: 8,
          parallelCount: 4,
        },
      },
      {
        id: "cpu-bypass",
        name: "CPU bypass + perf plate",
        from: "inlet",
        to: "outlet",
        fluid: "air-25C",
        component: {
          type: "orifice",
          lossModel: "k-factor",
          geometry: { L: 0, D: 0.08, eps: 0 },
          K: Math.max(Kperf, 0.5),
        },
      },
    ],
    couplings: [],
  };
}

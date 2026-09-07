import type { Project } from "../types";
import { EXAMPLE_SPAN_X } from "./canvasPitch";

const CFM = 1 / 2118.8799727597;
const IN_H2O = 249.08891;

/**
 * Synthetic server AMD from MF08 design goals + Table 1 totals.
 * Free delivery and shutoff are not published; we place the Case B operating
 * point (162 CFM) near mid-curve and set shutoff from a typical 1U server
 * fan head (~0.6 inH2O). Documented synthetic — not a vendor catalog.
 */
export const MF08_FAN = {
  // Synthetic endpoints chosen so Case B lands near Table 1 total (~162 CFM)
  // with the documented chassis/PCI/exhaust impedance below — not a catalog.
  dpMaxPa: 0.45 * IN_H2O,
  qMax: 320 * CFM,
};

export type Mf08Case = "A" | "B" | "C";

/**
 * MF08 air-cooled server bypass balance with fan + richer impedance.
 * Topology (flow-only): chassis → fan bank → (processors ∥ CPU bypass) →
 * (PCI 1–6 ∥ PCI 7–10) → exhaust.
 * Case A: bypass 100% open. Case B: 36% open. Case C: B + lower exhaust K.
 */
export function mf08ServerFan(caseId: Mf08Case = "B"): Project {
  const bypassOpen = caseId === "A" ? 1.0 : 0.36;
  const sigma = Math.min(0.999, Math.max(0.05, bypassOpen));
  const Kperf = 1 / (sigma * sigma) - 1;
  const Kexhaust = caseId === "C" ? 1.2 : 3.5;
  const qMax = MF08_FAN.qMax;
  const dpMax = MF08_FAN.dpMaxPa;

  return {
    version: "0.1.0",
    meta: {
      name: `MF08 Case ${caseId} fan+impedance`,
      description:
        "MF08 processor∥bypass with synthetic fan and chassis/PCI/exhaust legs. No vendor catalogs.",
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
        id: "after-fan",
        kind: "junction",
        x: 80,
        y: 0,
        z: 0,
        fluid: "air-25C",
      },
      {
        id: "after-cpu",
        kind: "junction",
        x: 200,
        y: 0,
        z: 0,
        fluid: "air-25C",
      },
      {
        id: "after-pci",
        kind: "junction",
        x: 320,
        y: 0,
        z: 0,
        fluid: "air-25C",
      },
      {
        id: "exit",
        kind: "boundary",
        x: 440,
        y: 0,
        z: 0,
        fluid: "air-25C",
        pFixed: 101325,
        tFixed: 298.15,
      },
    ],
    links: [
      {
        id: "chassis-fans",
        name: "Chassis inlet + fan bank",
        from: "ambient",
        to: "after-fan",
        fluid: "air-25C",
        component: {
          type: "fan",
          lossModel: "k-factor",
          geometry: { L: 0.08, D: 0.18, eps: 0 },
          K: 0.8,
          fan: {
            coeffs: [dpMax, 0, -dpMax / (qMax * qMax)],
            dpMin: 0,
          },
        },
      },
      {
        id: "processors",
        name: "Processors x4",
        from: "after-fan",
        to: "after-cpu",
        fluid: "air-25C",
        component: {
          type: "duct",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.12, D: 0.055, eps: 1e-4 },
          K: 4,
          parallelCount: 4,
        },
      },
      {
        id: "cpu-bypass",
        name: "CPU bypass + perf plate",
        from: "after-fan",
        to: "after-cpu",
        fluid: "air-25C",
        component: {
          type: "orifice",
          lossModel: "k-factor",
          geometry: { L: 0, D: 0.14, eps: 0 },
          K: Math.max(Kperf, 0.3),
        },
      },
      {
        id: "pci-1-6",
        name: "PCI cards 1-6",
        from: "after-cpu",
        to: "after-pci",
        fluid: "air-25C",
        component: {
          type: "duct",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.1, D: 0.04, eps: 1e-4 },
          K: 2.5,
          parallelCount: 6,
        },
      },
      {
        id: "pci-7-10",
        name: "PCI cards 7-10",
        from: "after-cpu",
        to: "after-pci",
        fluid: "air-25C",
        component: {
          type: "duct",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.1, D: 0.04, eps: 1e-4 },
          K: 2.5,
          parallelCount: 4,
        },
      },
      {
        id: "exhaust",
        name: "System exhaust",
        from: "after-pci",
        to: "exit",
        fluid: "air-25C",
        component: {
          type: "orifice",
          lossModel: "k-factor",
          geometry: { L: 0, D: 0.18, eps: 0 },
          K: Kexhaust,
        },
      },
    ],
    couplings: [],
  };
}

/** Legacy fixed-total qualitative bypass (kept for Case A/B direction test). */
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
        x: EXAMPLE_SPAN_X,
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

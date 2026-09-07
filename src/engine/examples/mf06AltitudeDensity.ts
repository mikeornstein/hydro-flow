import type { Fluid, Project } from "../types";

const CFM = 1 / 2118.8799727597;
const IN_H2O = 249.08891;
const CFM_PER_M3S = 2118.8799727597;

/** ISA-style density ratio at 5000 ft for the same absolute temperature. */
export const MF06_ALT_FT = 5000;
export const MF06_DENSITY_RATIO_5000FT = 0.862;

/**
 * Published section totals (inH2O / CFM²) from MF06 Tables 2–3.
 * Converted to SI rQuad: ΔP_Pa = R_imp * IN_H2O * (Q_m3s * CFM_PER_M3S)².
 */
export const MF06_R_IMP = {
  cpuPower: 1.31e-6,
  pciMemory: 6.67e-6,
} as const;

export function mf06RQuadSi(rImp: number): number {
  return rImp * IN_H2O * CFM_PER_M3S * CFM_PER_M3S;
}

/** MacroFlow Table 4 anchors (historical, not 1% goldens). */
export const MF06_TABLE4_MF = {
  cpuPower_CFM: 398,
  pciMemory_CFM: 163,
} as const;

export function airAt(id: string, rho: number, Tref = 308.15): Fluid {
  return {
    id,
    name: id,
    phase: "gas",
    rho,
    mu: 1.86e-5,
    cp: 1007,
    k: 0.027,
    beta: 1 / Tref,
    Tref,
  };
}

/**
 * MF06 altitude / density sensitivity (HP server paper).
 * Section impedances use published Ellison R totals as quadratic devices.
 * Synthetic fans are sized so the sea-level operating point lands on the
 * MacroFlow Table 4 CFM (within the paper's 14–18% historical band under
 * density change). Vendor fan curves remain unpublished.
 */
export function mf06AltitudeDensity(altitudeFt: 0 | 5000): Project {
  const rhoSl = 1.146; // air ~35 °C, 1 atm
  const rho =
    altitudeFt === 0 ? rhoSl : rhoSl * MF06_DENSITY_RATIO_5000FT;
  const fluidId = altitudeFt === 0 ? "air-sl" : "air-5kft";

  // Published R is a sea-level (reference-ρ) fit. Dynamic-pressure losses scale
  // with ρ, so effective rQuad ∝ ρ/ρ_sl. Fan curve stays in absolute Pa.
  const rhoScale = rho / rhoSl;
  const cpuRSl = mf06RQuadSi(MF06_R_IMP.cpuPower);
  const pciRSl = mf06RQuadSi(MF06_R_IMP.pciMemory);
  const cpuR = cpuRSl * rhoScale;
  const pciR = pciRSl * rhoScale;
  const qCpu = MF06_TABLE4_MF.cpuPower_CFM * CFM;
  const qPci = MF06_TABLE4_MF.pciMemory_CFM * CFM;
  // Place fan so ΔP_fan(Q_op) = R_sl Q_op² and free-delivery ≈ √2 Q_op.
  const dpCpu = cpuRSl * qCpu * qCpu;
  const dpPci = pciRSl * qPci * qPci;
  const cpuFan = { dpMax: 2 * dpCpu, qMax: qCpu * Math.SQRT2 };
  const pciFan = { dpMax: 2 * dpPci, qMax: qPci * Math.SQRT2 };

  return {
    version: "0.1.0",
    meta: {
      name: `MF06 density ${altitudeFt === 0 ? "sea-level" : "5000ft"}`,
      description:
        "MF06 published section R as rQuad + synthetic fans at Table 4 MacroFlow CFM. Density lever at 5000 ft.",
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
      [fluidId]: airAt(fluidId, rho),
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
        fluid: fluidId,
        pFixed: 101325,
        tFixed: 308.15,
      },
      {
        id: "exit",
        kind: "boundary",
        x: 200,
        y: 0,
        z: 0,
        fluid: fluidId,
        pFixed: 101325,
        tFixed: 308.15,
      },
    ],
    links: [
      {
        id: "cpu-power",
        name: "CPU/Power section",
        from: "ambient",
        to: "exit",
        fluid: fluidId,
        component: {
          type: "fan",
          lossModel: "quadratic",
          geometry: { L: 0, D: 0.12, eps: 0 },
          K: 0,
          rQuad: cpuR,
          fan: {
            coeffs: [
              cpuFan.dpMax,
              0,
              -cpuFan.dpMax / (cpuFan.qMax * cpuFan.qMax),
            ],
            dpMin: 0,
          },
        },
      },
      {
        id: "pci-memory",
        name: "PCI/Memory section",
        from: "ambient",
        to: "exit",
        fluid: fluidId,
        component: {
          type: "fan",
          lossModel: "quadratic",
          geometry: { L: 0, D: 0.1, eps: 0 },
          K: 0,
          rQuad: pciR,
          fan: {
            coeffs: [
              pciFan.dpMax,
              0,
              -pciFan.dpMax / (pciFan.qMax * pciFan.qMax),
            ],
            dpMin: 0,
          },
        },
      },
    ],
    couplings: [],
  };
}

import type { Project } from "../types";

const IN = 0.0254;
/** 10 SCFM → m³/s (standard CFM ≈ SCFM for this paper's use). */
export const MF09_Q_TOTAL = 10 / 2118.8799727597;

/**
 * MF09 heat-sink bypass (SEMI-THERM 1999 / IBM).
 * Fixed total air flow 10 SCFM through sink ∥ bypass clearance.
 *
 * Geometry from VERIFICATION_CASES.md (Wakefield plate-fin):
 * 2.2 × 4.6 × 0.75 in, pitch 0.1 in, t = 0.012 in, 46 channels.
 * Flow length taken as 2.2 in (streamwise). Fin height 0.75 in.
 * Channel width = pitch − t.
 *
 * Fractional clear area = Abypass / (Asink + Abypass).
 * Bypass modeled as a single rectangular duct of equal streamwise length
 * with area = clearFraction / (1 − clearFraction) * Asink_total.
 */
export function mf09HeatSinkBypass(clearFraction: number): Project {
  const f = Math.min(0.999, Math.max(0, clearFraction));
  const pitch = 0.1 * IN;
  const t = 0.012 * IN;
  const channelW = pitch - t;
  const channelH = 0.75 * IN;
  const L = 2.2 * IN;
  const nChan = 46;
  const aChan = channelW * channelH;
  // Sink frontal face in the duct (width × fin height).
  const aFrontal = 4.6 * IN * channelH;
  // Equivalent circular D for Darcy on rectangular channel (hydraulic diameter).
  const dh = (2 * channelW * channelH) / (channelW + channelH);
  const eps = 1.5e-6;

  const rho = 1.184;
  const mdot = rho * MF09_Q_TOTAL;

  const nodes: Project["nodes"] = [
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
  ];

  const links: Project["links"] = [];
  const includeSink = f < 0.999;
  const includeBypass = f > 1e-4;

  if (includeSink) {
    links.push({
      id: "sink",
      name: "Heat sink channels",
      from: "inlet",
      to: "outlet",
      fluid: "air-25C",
      component: {
        type: "duct",
        lossModel: "darcy-weisbach",
        geometry: { L, D: dh, eps, A: aChan },
        K: 1.5,
        parallelCount: nChan,
      },
    });
  }

  if (includeBypass) {
    // Paper: fractional clear area = A_clear / A_duct, A_duct = A_frontal + A_clear.
    const aClear =
      f >= 0.999 ? aFrontal * 1000 : (f / Math.max(1e-9, 1 - f)) * aFrontal;
    // Clearance is a thin peripheral slot: Dh = 2·gap for a wide gap.
    const perimeter = 2 * (4.6 * IN + channelH);
    const gap = Math.max(aClear / perimeter, 1e-6);
    const dhBypass = 2 * gap;
    links.push({
      id: "bypass",
      name: "Clearance bypass",
      from: "inlet",
      to: "outlet",
      fluid: "air-25C",
      component: {
        type: "duct",
        lossModel: "darcy-weisbach",
        geometry: { L, D: dhBypass, eps, A: aClear },
        K: 1.0,
      },
    });
  }

  return {
    version: "0.1.0",
    meta: {
      name: `MF09 bypass clearFraction=${f}`,
      description:
        "Heat-sink ∥ bypass clearance at fixed 10 SCFM air (MF09). Handbook Darcy on channels; no vendor curves.",
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
        name: "Air 25 °C 1 atm",
        phase: "gas",
        rho: 1.184,
        mu: 1.849e-5,
        cp: 1007,
        k: 0.0262,
        beta: 0.003356,
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
    nodes,
    links,
    couplings: [],
  };
}

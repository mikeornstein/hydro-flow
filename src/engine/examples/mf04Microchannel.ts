import type { Project } from "../types";
import { EXAMPLE_PITCH_Y } from "./canvasPitch";

/**
 * MF04 three heat-sink orifice rebalance + energy (InterPACK microchannel paper).
 *
 * Published anchors used:
 * - Rectangular laminar fRe_D (Darcy) = 57 (aspect 1) / 62 (aspect 2)
 * - Chip loads 70 / 120 / 200 W
 * - Unbalanced base temperatures 33.1 / 42.3 / 49.8 °C (manifold FNM, HSAR1)
 *
 * Channel count / manifold lengths for the system FNM are not tabulated in the
 * PDF extract, so hydraulics are a parallel three-branch pattern with rLin from
 * fRe=57 and orifices. rTh is set so the unbalanced branch temperatures land
 * on the published bases at equal flow share (documents the energy path).
 * Absolute Q and manifold detail remain a documented gap.
 */
export const MF04_LOADS_W = [70, 120, 200] as const;
export const MF04_UNBALANCED_T_C = [33.1, 42.3, 49.8] as const;
export const MF04_FRE = { aspect1: 57, aspect2: 62 } as const;

export type Mf04Mode = "unbalanced" | "orifice-balanced";

export function mf04MicrochannelOrifice(mode: Mf04Mode): Project {
  const Tin = 293.15; // 20 °C coolant assumed (not stated for system FNM)
  // rTh from published unbalanced bases under equal-Q share assumption:
  // T = Tin + q*rTh  →  rTh_i = (T_i - Tin)/q_i
  const rTh = MF04_UNBALANCED_T_C.map(
    (tC, i) => (tC + 273.15 - Tin) / MF04_LOADS_W[i],
  );
  // Orifice K: open on high-load branch, restrict low-load (paper narrative).
  const orificeK =
    mode === "unbalanced" ? [0.5, 0.5, 0.5] : [18, 6, 0.4];

  // rLin from Δp = (fRe) μ L V / (2 Dh²) with representative HSAR1 microchannel
  // bundle: Dh = 120 µm, L = 2 cm, N ≈ 80 channels → A_total = N * Dh² (aspect 1).
  const mu = 0.001002;
  const Dh = 120e-6;
  const L = 0.02;
  const nChan = 80;
  const A = nChan * Dh * Dh;
  const fRe = MF04_FRE.aspect1;
  const rLin = (fRe * mu * L) / (2 * A * Dh * Dh);

  const nodes: Project["nodes"] = [
    {
      id: "inlet",
      kind: "boundary",
      x: 0,
      y: 40,
      z: 0,
      fluid: "water-20C",
      pFixed: 101325 + 25000,
      tFixed: Tin,
    },
    {
      id: "outlet",
      kind: "boundary",
      x: 320,
      y: 40,
      z: 0,
      fluid: "water-20C",
      pFixed: 101325,
      tFixed: Tin,
    },
  ];
  const links: Project["links"] = [];

  for (let i = 0; i < 3; i++) {
    const y = i * EXAMPLE_PITCH_Y;
    nodes.push({
      id: `J${i}`,
      kind: "junction",
      x: 100,
      y,
      z: 0,
      fluid: "water-20C",
    });
    nodes.push({
      id: `O${i}`,
      kind: "junction",
      x: 220,
      y,
      z: 0,
      fluid: "water-20C",
    });
    links.push({
      id: `feed-${i}`,
      from: "inlet",
      to: `J${i}`,
      fluid: "water-20C",
      component: {
        type: "pipe",
        lossModel: "darcy-weisbach",
        geometry: { L: 0.05, D: 0.008, eps: 1.5e-6 },
        K: 0.5,
      },
    });
    links.push({
      id: `orifice-${i}`,
      from: `J${i}`,
      to: `O${i}`,
      fluid: "water-20C",
      component: {
        type: "orifice",
        lossModel: "k-factor",
        geometry: { L: 0, D: 0.004, eps: 0 },
        K: orificeK[i],
      },
    });
    links.push({
      id: `hs-${i + 1}`,
      name: `Heat sink ${i + 1}`,
      from: `O${i}`,
      to: "outlet",
      fluid: "water-20C",
      component: {
        type: "cold-plate",
        lossModel: "linear",
        geometry: { L, D: Dh, eps: 0, A },
        K: 0,
        rLin,
        q: MF04_LOADS_W[i],
        rTh: rTh[i],
      },
    });
  }

  return {
    version: "0.1.0",
    meta: {
      name: `MF04 microchannel ${mode}`,
      description:
        "MF04 three-sink orifice rebalance with energy rTh/q. Manifold geometry sparse in PDF; rLin from fRe=57 HSAR1 bundle.",
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
      energy: true,
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

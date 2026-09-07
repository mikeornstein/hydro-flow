import type { Project } from "../types";

const CFM = 1 / 2118.8799727597;
const IN_H2O = 249.08891;

/** Published fan endpoints (MF13). Synthetic curve, not a catalog scrape. */
export const MF13_FAN = {
  dpMaxPa: 0.8 * IN_H2O,
  qMax: 240 * CFM,
};

export type Mf13Design = "I" | "II";

export interface Mf13Options {
  /** Idelchik sharp tees at bottom header / passage junctions. */
  tees?: boolean;
  design?: Mf13Design;
}

/**
 * MF13 electronic card cabinet (design-process paper).
 * Bottom header feeds 10 equal card passages; top plenum to screened exit.
 * Design I: constant 4 cm bottom height. Design II: 18° floor taper.
 *
 * Design II + tees: each tee sits in an equal-area run pocket (Idelchik
 * equal-area run). Area changes happen at plain mid-junctions between tees.
 *
 * Geometry from Fig 1 (cm) plus a documented board-depth assumption (16 cm)
 * because depth into the page is unlabeled. Fan curve uses only the published
 * max head / max flow endpoints.
 */
export function mf13CardCabinet({
  tees = false,
  design = "I",
}: Mf13Options = {}): Project {
  const n = 10;
  const arrayW = 0.1;
  const pitch = arrayW / n;
  const cardT = 0.0016;
  const gap = pitch - cardT;
  const depth = 0.16;
  const passH = 0.25;
  const h0 = 0.04;
  const taper = design === "II" ? (18 * Math.PI) / 180 : 0;
  const eps = 1.5e-4;
  const sigma = 0.5;
  const Kscreen = 1 / (sigma * sigma) - 1;

  const aPass = gap * depth;
  const dhPass = (2 * gap * depth) / (gap + depth);

  const heightAt = (i: number): number => {
    const x = (i + 0.5) * pitch;
    return Math.max(0.005, h0 - x * Math.tan(taper));
  };

  const nodes: Project["nodes"] = [
    {
      id: "ambient-in",
      kind: "boundary",
      name: "Ambient inlet",
      x: -80,
      y: 0,
      z: 0,
      fluid: "air-27C",
      pFixed: 101325,
      tFixed: 300.15,
    },
    {
      id: "fan-out",
      kind: "junction",
      name: "After fan",
      x: -40,
      y: 0,
      z: 0,
      fluid: "air-27C",
    },
    {
      id: "exit",
      kind: "boundary",
      name: "Screened exit",
      x: 200,
      y: 120,
      z: 0,
      fluid: "air-27C",
      pFixed: 101325,
      tFixed: 300.15,
    },
  ];
  const links: Project["links"] = [];

  for (let i = 0; i < n; i++) {
    const tee = tees ? { tee: { branch: `pass-${i + 1}` } } : {};
    nodes.push({
      id: `T${i}`,
      kind: "junction",
      name: `Tee ${i + 1}`,
      x: i * 40,
      y: 0,
      z: 0,
      fluid: "air-27C",
      ...tee,
    });
    nodes.push({
      id: `P${i}`,
      kind: "junction",
      name: `Plenum ${i + 1}`,
      x: i * 40,
      y: 80,
      z: 0,
      fluid: "air-27C",
    });
    if (i < n - 1 && (tees || design === "II")) {
      nodes.push({
        id: `M${i}`,
        kind: "junction",
        name: `Header mid ${i + 1}`,
        x: i * 40 + 20,
        y: 0,
        z: 0,
        fluid: "air-27C",
      });
    }
  }

  const qMax = MF13_FAN.qMax;
  const dpMax = MF13_FAN.dpMaxPa;
  links.push({
    id: "inlet-fan",
    name: "Inlet screen + fan",
    from: "ambient-in",
    to: "fan-out",
    fluid: "air-27C",
    component: {
      type: "fan",
      lossModel: "k-factor",
      geometry: { L: 0.05, D: 0.12, eps: 0 },
      K: Kscreen,
      fan: {
        coeffs: [dpMax, 0, -dpMax / (qMax * qMax)],
        dpMin: 0,
      },
    },
  });

  const hFirst = heightAt(0);
  links.push({
    id: "to-T0",
    name: "Header approach",
    from: "fan-out",
    to: "T0",
    fluid: "air-27C",
    component: headerSeg(hFirst, depth, pitch / 2, eps, 0.5),
  });

  for (let i = 0; i < n - 1; i++) {
    const hi = heightAt(i);
    const hj = heightAt(i + 1);
    if (tees || design === "II") {
      // Equal-area run pocket on each side of the tee; area change at M_i.
      links.push({
        id: `hdr-${i}a`,
        name: `Header ${i + 1}a`,
        from: `T${i}`,
        to: `M${i}`,
        fluid: "air-27C",
        component: headerSeg(hi, depth, pitch / 2, eps, 0),
      });
      const areaRatio = Math.min(hi, hj) / Math.max(hi, hj);
      const Kexp = hi >= hj ? Math.pow(1 - areaRatio, 2) : 0.5 * Math.pow(1 - areaRatio, 2);
      links.push({
        id: `hdr-${i}b`,
        name: `Header ${i + 1}b`,
        from: `M${i}`,
        to: `T${i + 1}`,
        fluid: "air-27C",
        component: headerSeg(hj, depth, pitch / 2, eps, Kexp),
      });
    } else {
      const h = 0.5 * (hi + hj);
      links.push({
        id: `hdr-${i}`,
        name: `Bottom header ${i + 1}`,
        from: `T${i}`,
        to: `T${i + 1}`,
        fluid: "air-27C",
        component: headerSeg(h, depth, pitch, eps, 0),
      });
    }
  }

  for (let i = 0; i < n; i++) {
    links.push({
      id: `pass-${i + 1}`,
      name: `Pass-${i + 1}`,
      from: `T${i}`,
      to: `P${i}`,
      fluid: "air-27C",
      component: {
        type: "duct",
        lossModel: "darcy-weisbach",
        geometry: { L: passH, D: dhPass, eps, A: aPass },
        K: 1.5,
      },
    });
    links.push({
      id: `to-exit-${i + 1}`,
      name: `Plenum to exit ${i + 1}`,
      from: `P${i}`,
      to: "exit",
      fluid: "air-27C",
      component: {
        type: "duct",
        lossModel: "k-factor",
        geometry: { L: 0.05, D: dhPass, eps, A: aPass },
        K: Kscreen / n + 0.5,
      },
    });
  }

  return {
    version: "0.1.0",
    meta: {
      name: `MF13 Design ${design}${tees ? " tees" : " friction"}`,
      description:
        "MF13 card cabinet. Fig 1 geometry + synthetic fan from published endpoints. Depth 16 cm assumed.",
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
      "air-27C": {
        id: "air-27C",
        name: "Air 27 °C",
        phase: "gas",
        rho: 1.177,
        mu: 1.85e-5,
        cp: 1007,
        k: 0.026,
        beta: 0.0033,
        Tref: 300.15,
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

function headerSeg(
  height: number,
  depth: number,
  L: number,
  eps: number,
  K: number,
): Project["links"][number]["component"] {
  const A = height * depth;
  const Dh = (2 * height * depth) / (height + depth);
  return {
    type: "duct",
    lossModel: "darcy-weisbach",
    geometry: { L, D: Dh, eps, A },
    K,
  };
}

export function mf13PassageCfm(
  solved: { links: Record<string, { Q: number }> },
): number[] {
  const out: number[] = [];
  for (let i = 1; i <= 10; i++) {
    out.push(solved.links[`pass-${i}`].Q / CFM);
  }
  return out;
}

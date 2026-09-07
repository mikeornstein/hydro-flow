import type { Project } from "../types";

const IN = 0.0254;
/** 5 gal/min → m³/s */
export const MF03_Q_TOTAL = 5 * 6.30901964e-5;
const GPM = 6.30901964e-5;

export type Mf03HeaderKind = "7/16" | "7/8";

export function headerDiameterM(kind: Mf03HeaderKind): number {
  return kind === "7/16" ? (7 / 16) * IN : (7 / 8) * IN;
}

export interface Mf03HeaderOptions {
  /**
   * Idelchik sharp 90° tees at every header/lateral junction (Fig 2 of the
   * paper). The far end has no run continuation, which the tee model treats as
   * the q = 1 sharp-elbow limit. Default false keeps the friction-only replay.
   */
  tees?: boolean;
}

/**
 * MF03 U-header cold plate (InterPACK 2003).
 * Seven 1/4" × 7" laterals at 1" pitch; headers 7/16" or 7/8".
 * Total water flow fixed at 5 gpm via inlet mdotSource.
 *
 * Assumptions (documented, not MacroFlow catalogs):
 * - Smooth copper ε = 1.5e-6 m
 * - Laterals: friction only (K = 0) unless `tees`, then Idelchik sharp-tee legs
 * - Inlet/outlet K = 0.5 on header velocity
 * - Gravity off (planar cold plate)
 */
export function mf03ColdPlateHeader(
  kind: Mf03HeaderKind,
  { tees = false }: Mf03HeaderOptions = {},
): Project {
  const headerD = headerDiameterM(kind);
  const branchD = 0.25 * IN;
  const branchL = 7 * IN;
  const pitch = 1 * IN;
  const eps = 1.5e-6;
  const rho = 998.2;
  const mdot = rho * MF03_Q_TOTAL;

  const nodes: Project["nodes"] = [
    {
      id: "inlet",
      kind: "junction",
      name: "Inlet",
      x: -40,
      y: 0,
      z: 0,
      fluid: "water-20C",
      mdotSource: mdot,
    },
    {
      id: "outlet",
      kind: "boundary",
      name: "Outlet",
      x: -40,
      y: 80,
      z: 0,
      fluid: "water-20C",
      pFixed: 101325,
      tFixed: 293.15,
    },
  ];
  const links: Project["links"] = [];

  for (let i = 0; i < 7; i++) {
    const tee = tees ? { tee: { branch: `cross-${i + 1}` } } : {};
    nodes.push({
      id: `F${i}`,
      kind: "junction",
      name: `Feed tee ${i + 1}`,
      x: i * 40,
      y: 0,
      z: 0,
      fluid: "water-20C",
      ...tee,
    });
    nodes.push({
      id: `C${i}`,
      kind: "junction",
      name: `Collect tee ${i + 1}`,
      x: i * 40,
      y: 80,
      z: 0,
      fluid: "water-20C",
      ...tee,
    });
  }

  links.push({
    id: "in-F0",
    name: "Inlet to feed",
    from: "inlet",
    to: "F0",
    fluid: "water-20C",
    component: {
      type: "pipe",
      lossModel: "darcy-weisbach",
      geometry: { L: pitch / 2, D: headerD, eps },
      K: 0.5,
    },
  });

  for (let i = 0; i < 6; i++) {
    links.push({
      id: `feed-${i}`,
      name: `Feed-${i + 1}`,
      from: `F${i}`,
      to: `F${i + 1}`,
      fluid: "water-20C",
      component: {
        type: "pipe",
        lossModel: "darcy-weisbach",
        geometry: { L: pitch, D: headerD, eps },
        K: 0,
      },
    });
  }

  for (let i = 0; i < 7; i++) {
    links.push({
      id: `cross-${i + 1}`,
      name: `Cross-${i + 1}`,
      from: `F${i}`,
      to: `C${i}`,
      fluid: "water-20C",
      component: {
        type: "pipe",
        lossModel: "darcy-weisbach",
        geometry: { L: branchL, D: branchD, eps },
        K: 0,
      },
    });
  }

  for (let i = 0; i < 6; i++) {
    links.push({
      id: `collect-${i}`,
      name: `Collect-${i + 1}`,
      from: `C${i + 1}`,
      to: `C${i}`,
      fluid: "water-20C",
      component: {
        type: "pipe",
        lossModel: "darcy-weisbach",
        geometry: { L: pitch, D: headerD, eps },
        K: 0,
      },
    });
  }

  links.push({
    id: "C0-out",
    name: "Collect to outlet",
    from: "C0",
    to: "outlet",
    fluid: "water-20C",
    component: {
      type: "pipe",
      lossModel: "darcy-weisbach",
      geometry: { L: pitch / 2, D: headerD, eps },
      K: 0.5,
    },
  });

  return {
    version: "0.1.0",
    meta: {
      name: `MF03 cold plate header ${kind}"${tees ? " (Idelchik tees)" : ""}`,
      description:
        `U-header 7-tube cold plate from MF03. Header ID ${kind}", laterals 1/4"×7" @ 1" pitch, Q=5 gpm water.` +
        (tees ? " Idelchik sharp 90° tees at every junction." : ""),
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

export function branchFlowsGpm(project: Project, linkQ: Record<string, { Q: number }>): number[] {
  return [1, 2, 3, 4, 5, 6, 7].map((i) => linkQ[`cross-${i}`].Q / GPM);
}

export { GPM };

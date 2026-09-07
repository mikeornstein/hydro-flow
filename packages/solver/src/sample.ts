import type { Project } from "./types.js";
import { FLUIDS } from "./fluids.js";

/**
 * A small demonstrable irrigation-style network: a pressurised source feeds a
 * main line to a junction that splits into two laterals delivering to
 * atmospheric outlets. Exercises a parallel split and a minor-loss valve.
 */
export function sampleProject(): Project {
  return {
    version: "0.1.0",
    meta: { name: "Two-lateral delivery", description: "Pressurised source → split → two outlets" },
    fluid: FLUIDS.water,
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      gravity: true,
      convergence: { massResidual: 1e-9, maxIter: 100, relaxationP: 1 },
    },
    nodes: [
      { id: "source", kind: "boundary", x: 0, y: 120, z: 0, pFixed: 400000 },
      { id: "split", kind: "junction", x: 260, y: 120, z: 0 },
      { id: "outletA", kind: "boundary", x: 560, y: 40, z: 0, pFixed: 101325 },
      { id: "outletB", kind: "boundary", x: 560, y: 200, z: 0, pFixed: 101325 },
    ],
    links: [
      {
        id: "main",
        from: "source",
        to: "split",
        component: {
          type: "pipe",
          lossModel: "darcy-weisbach",
          geometry: { L: 50, D: 0.1, eps: 4.6e-5 },
        },
      },
      {
        id: "lateralA",
        from: "split",
        to: "outletA",
        component: {
          type: "pipe",
          lossModel: "darcy-weisbach",
          geometry: { L: 120, D: 0.05, eps: 4.6e-5 },
        },
      },
      {
        id: "lateralB",
        from: "split",
        to: "outletB",
        component: {
          type: "valve",
          lossModel: "k-factor",
          K: 6,
          geometry: { L: 120, D: 0.05, eps: 4.6e-5 },
        },
      },
    ],
  };
}

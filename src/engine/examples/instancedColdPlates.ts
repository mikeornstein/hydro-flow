import type { Project } from "../types";
import { EXAMPLE_PITCH_X, EXAMPLE_PITCH_Y, EXAMPLE_SPAN_X } from "./canvasPitch";

const IN = 0.0254;

export const CHANNEL_PACK_PARAMS = {
  nChannels: 7,
  headerD: (7 / 16) * IN,
  branchD: 0.25 * IN,
  branchL: 7 * IN,
  pitch: 1 * IN,
  eps: 1.5e-6,
  tees: false,
} as const;

export const INSTANCED_PLATE_COUNT = 3;

const WATER = {
  id: "water-20C",
  name: "Water 20 °C",
  phase: "liquid" as const,
  rho: 998.2,
  mu: 0.001002,
  cp: 4182,
  k: 0.598,
  beta: 0.000207,
  Tref: 293.15,
};

export function instancedColdPlates(count: number = INSTANCED_PLATE_COUNT): Project {
  const midY = EXAMPLE_PITCH_Y;
  return {
    version: "0.1.0",
    meta: {
      name: "Three identical cold-plate channel packs",
      description:
        "Three packs share one module's parameters. No copy-paste deck; internals exist only after expand.",
      createdAt: "2026-09-11T00:00:00Z",
      updatedAt: "2026-09-11T00:00:00Z",
    },
    units: {
      system: "SI",
      length: "m",
      pressure: "Pa",
      flow: "m3/s",
      temperature: "K",
      power: "W",
    },
    fluids: { "water-20C": WATER },
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
        kind: "boundary",
        name: "Inlet",
        x: 0,
        y: midY,
        z: 0,
        fluid: "water-20C",
        pFixed: 150000,
        tFixed: 293.15,
      },
      {
        id: "supply",
        kind: "junction",
        name: "Supply header",
        x: EXAMPLE_PITCH_X,
        y: midY,
        z: 0,
        fluid: "water-20C",
      },
      {
        id: "return",
        kind: "junction",
        name: "Return header",
        x: EXAMPLE_PITCH_X * 3,
        y: midY,
        z: 0,
        fluid: "water-20C",
      },
      {
        id: "outlet",
        kind: "boundary",
        name: "Outlet",
        x: EXAMPLE_SPAN_X + EXAMPLE_PITCH_X,
        y: midY,
        z: 0,
        fluid: "water-20C",
        pFixed: 101325,
        tFixed: 293.15,
      },
    ],
    links: [
      {
        id: "in-supply",
        name: "Inlet header",
        from: "inlet",
        to: "supply",
        fluid: "water-20C",
        component: {
          type: "pipe",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.02, D: 0.2, eps: 1.5e-6 },
          K: 0,
        },
      },
      {
        id: "return-out",
        name: "Return header",
        from: "return",
        to: "outlet",
        fluid: "water-20C",
        component: {
          type: "pipe",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.02, D: 0.2, eps: 1.5e-6 },
          K: 0,
        },
      },
    ],
    couplings: [],
    modules: [
      {
        id: "channel-pack",
        name: "Cold-plate channel pack",
        kind: "u-manifold-pack",
        params: { ...CHANNEL_PACK_PARAMS },
      },
    ],
    instances: [
      {
        id: "plates",
        name: "Cold-plate pack",
        module: "channel-pack",
        count,
        ports: { inlet: "supply", outlet: "return" },
        x: EXAMPLE_PITCH_X * 2,
        y: 0,
        fluid: "water-20C",
      },
    ],
  };
}

import type { PressurePoint, Project } from "../types";
import { EXAMPLE_SPAN_X } from "./canvasPitch";

/**
 * Closed forms the two tables below were sampled from. Kept so tests can solve
 * the same network with the smooth laws and bound the interpolation error.
 * Fan  ΔP = dpMax (1 − (Q / qMax)²)  Pa. Sink Δp = a Q² + b Q  Pa.
 */
export const USER_CURVE_FAN = { dpMax: 150, qMax: 0.075 };
export const USER_CURVE_SINK = { a: 5e5, b: 2000 };

/** Seven samples of the fan law, rounded the way a data sheet would print them. */
export const USER_CURVE_FAN_TABLE: PressurePoint[] = [
  { Q: 0, dP: 150 },
  { Q: 0.0125, dP: 145.8 },
  { Q: 0.025, dP: 133.3 },
  { Q: 0.0375, dP: 112.5 },
  { Q: 0.05, dP: 83.3 },
  { Q: 0.0625, dP: 45.8 },
  { Q: 0.075, dP: 0 },
];

/** Six samples of the sink law, the shape a CFD sweep of a CPU heat sink returns. */
export const USER_CURVE_SINK_TABLE: PressurePoint[] = [
  { Q: 0, dP: 0 },
  { Q: 0.004, dP: 16 },
  { Q: 0.008, dP: 48 },
  { Q: 0.012, dP: 96 },
  { Q: 0.016, dP: 160 },
  { Q: 0.02, dP: 240 },
];

export type UserCurveMode = "table" | "closed-form";

/**
 * W15 user-curve import. A fan defined only by a pasted ΔP(Q) table blows
 * through a CPU heat sink whose impedance is a pasted Δp(Q) table (the way an
 * MF08-style sink comes out of CFD), in parallel with a K-factor bypass slot.
 * Both tables are synthetic and documented above — not a vendor catalog.
 * `closed-form` swaps the tables for the smooth laws they were sampled from.
 */
export function userCurveTables(mode: UserCurveMode = "table"): Project {
  const tables = mode === "table";
  const { dpMax, qMax } = USER_CURVE_FAN;
  return {
    version: "0.1.0",
    meta: {
      name: "User curve tables: fan and heat sink",
      description:
        "Fan ΔP(Q) and heat-sink Δp(Q) entered as pasted tables, bypass slot as a K-factor. Synthetic samples, no vendor catalog.",
      createdAt: "2026-09-08T00:00:00Z",
      updatedAt: "2026-09-08T00:00:00Z",
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
        name: "Dry air (25 °C)",
        phase: "gas",
        rho: 1.184,
        mu: 1.849e-5,
        cp: 1007,
        k: 0.0263,
        beta: 1 / 298.15,
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
        maxIter: 120,
        relaxationP: 0.7,
        relaxationQ: 0.7,
      },
    },
    nodes: [
      {
        id: "ambient",
        kind: "boundary",
        name: "Ambient",
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
        name: "Plenum",
        x: EXAMPLE_SPAN_X / 2,
        y: 0,
        z: 0,
        fluid: "air-25C",
      },
      {
        id: "exit",
        kind: "boundary",
        name: "Exit",
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
        id: "fan",
        name: "Fan (pasted curve)",
        from: "ambient",
        to: "plenum",
        fluid: "air-25C",
        component: {
          type: "fan",
          lossModel: "k-factor",
          geometry: { L: 0, D: 0.09, eps: 0 },
          K: 0,
          fan: tables
            ? { table: USER_CURVE_FAN_TABLE }
            : { coeffs: [dpMax, 0, -dpMax / (qMax * qMax)] },
        },
      },
      {
        id: "heat-sink",
        name: "CPU heat sink (pasted impedance)",
        from: "plenum",
        to: "exit",
        fluid: "air-25C",
        component: {
          type: "generic-resistance",
          lossModel: tables ? "k-factor" : "quadratic",
          geometry: { L: 0, D: 0.06, eps: 0 },
          K: 0,
          ...(tables
            ? { dpTable: USER_CURVE_SINK_TABLE }
            : { rQuad: USER_CURVE_SINK.a, rLin: USER_CURVE_SINK.b }),
        },
      },
      {
        id: "bypass",
        name: "Bypass slot",
        from: "plenum",
        to: "exit",
        fluid: "air-25C",
        component: {
          type: "orifice",
          lossModel: "k-factor",
          geometry: { L: 0, D: 0.1, eps: 0 },
          K: 13,
        },
      },
    ],
    couplings: [],
  };
}

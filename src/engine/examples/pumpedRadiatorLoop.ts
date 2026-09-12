import type { Diagram } from "../../diagram/types";
import { WATER_30C } from "../fluids";
import { P_ATM } from "../types";

/**
 * Worked example: a single pumped liquid loop that rejects one cold-plate
 * load through a radiator panel to a fixed-temperature sink.
 *
 * Topology (liquid, closed):
 *   tank → pump → cold plate (load) → radiator panel → tank
 *
 * There is no air stream and no fixed fluid temperature anywhere. The
 * radiator is the thermal ground. In steady state it rejects exactly the
 * cold-plate load, and the loop temperature floats to where ε C (T_in − T_sink)
 * equals that load.
 */
export const RAD_LOAD_W = 1500;
export const RAD_RTH = 0.02; // K/W, case-to-coolant
export const RAD_UA = 180; // W/K, panel fluid-to-sink, linearized
export const RAD_T_SINK = 288.15; // 15 °C effective sink
export const RAD_TANK_P = P_ATM + 50000; // 1.5 bar abs

/** Pump head H(Q) = 5 − 5e8 Q²  (m, Q in m³/s). Shutoff 5 m, zero-head 6 L/min. */
export const RAD_PUMP_COEFFS = [5, 0, -5e8];

/** Panel tube bundle: 8 tubes × 4 m × 8 mm. A = 8 · π · 0.008² / 4 ≈ 4.02e-4 m². */
export const RAD_PANEL = { L: 4, D: 0.008, A: 4.02e-4, K: 3 };

const LIQ = WATER_30C.id;
const copper = 1.5e-6;

export function pumpedRadiatorLoopDiagram(): Diagram {
  return {
    id: "pumped-radiator-loop",
    name: "Pumped loop — cold plate to radiator panel",
    description:
      "One cold plate on a closed water loop, circulated by a small pump through a radiator panel that rejects the heat to a fixed-temperature sink.",
    nodes: [
      {
        id: "tank",
        kind: "tank",
        name: "Expansion tank",
        x: 40,
        y: 320,
        z: 0.5,
        fluid: LIQ,
        params: { pFixed: RAD_TANK_P },
      },
      {
        id: "pump",
        kind: "pump",
        name: "Loop pump",
        x: 280,
        y: 320,
        z: 0.2,
        fluid: LIQ,
        params: { D: 0.016, L: 0, K: 1.2, pump: { coeffs: RAD_PUMP_COEFFS, hMin: 0 } },
      },
      {
        id: "load",
        kind: "coldPlate",
        name: "Compute cold plate",
        x: 540,
        y: 320,
        z: 0.3,
        fluid: LIQ,
        params: { L: 0.25, D: 0.008, eps: copper, K: 4, q: RAD_LOAD_W, rTh: RAD_RTH },
      },
      {
        id: "rad",
        kind: "radiator",
        name: "Radiator panel",
        x: 800,
        y: 120,
        z: 1.5,
        fluid: LIQ,
        params: { ...RAD_PANEL, eps: copper, radiator: { ua: RAD_UA, tSink: RAD_T_SINK } },
      },
    ],
    edges: [
      {
        id: "e-tank-pump",
        name: "Suction",
        from: { node: "tank", port: "port" },
        to: { node: "pump", port: "in" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 0.6, D: 0.016, eps: copper, K: 0.5 },
      },
      {
        id: "e-pump-load",
        name: "Discharge",
        from: { node: "pump", port: "out" },
        to: { node: "load", port: "in" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 1.2, D: 0.012, eps: copper, K: 0.8 },
      },
      {
        id: "e-load-rad",
        name: "Riser to panel",
        from: { node: "load", port: "out" },
        to: { node: "rad", port: "in" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 2.0, D: 0.012, eps: copper, K: 1.0 },
      },
      {
        id: "e-rad-tank",
        name: "Cooled return",
        from: { node: "rad", port: "out" },
        to: { node: "tank", port: "port" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 2.4, D: 0.016, eps: copper, K: 1.0 },
      },
    ],
  };
}

export function radPumpHeadM(Q: number): number {
  return Math.max(0, RAD_PUMP_COEFFS[0] + RAD_PUMP_COEFFS[2] * Q * Q);
}

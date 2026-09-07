import type { Diagram } from "../../diagram/types";
import { AIR_25C, WATER_30C } from "../fluids";
import { P_ATM } from "../types";

/**
 * Worked example: direct-liquid-cooled compute rack with a pumped CDU
 * and a forced-convection air–liquid heat exchanger.
 *
 * Topology (liquid, closed):
 *   tank → pump → filter → supply manifold
 *        → 4 GPU cold plates in parallel
 *        → return manifold → HEX (liquid) → tank
 *
 * Topology (air, open):
 *   ambient in → fan → HEX (air) → ambient out
 *
 * Heat: 4 × 700 W = 2800 W into the coolant at the cold plates.
 * The HEX must reject that heat to the air stream in steady state.
 */
export const DLC_GPU_POWER_W = 700;
export const DLC_GPU_COUNT = 4;
export const DLC_TOTAL_HEAT_W = DLC_GPU_POWER_W * DLC_GPU_COUNT;
export const DLC_RTH = 0.045; // K/W, case-to-coolant
export const DLC_HEX_UA = 520; // W/K
export const DLC_TANK_P = P_ATM + 50000; // 1.5 bar abs
export const DLC_AIR_TIN = 298.15; // 25 °C
export const DLC_AMBIENT_P = P_ATM;

/** Pump head H(Q) = 20 − 1.25e8 Q²  (m, Q in m³/s). Shutoff 20 m, zero-head ~24 L/min. */
export const DLC_PUMP_COEFFS = [20, 0, -1.25e8];

/** Fan ΔP(Q) = 280 − 5200 Q²  (Pa). Stall 280 Pa, free delivery ~0.232 m³/s (492 cfm). */
export const DLC_FAN_COEFFS = [280, 0, -5200];

const LIQ = WATER_30C.id;
const AIR = AIR_25C.id;
const copper = 1.5e-6;

function gpu(i: number, x: number, y: number) {
  return {
    id: `gpu${i}`,
    kind: "coldPlate" as const,
    name: `GPU ${i} cold plate`,
    x,
    y,
    z: 0.3,
    fluid: LIQ,
    params: {
      L: 0.22,
      D: 0.006,
      eps: copper,
      K: 5,
      q: DLC_GPU_POWER_W,
      rTh: DLC_RTH,
    },
  };
}

export function dlcPumpedCoolingDiagram(): Diagram {
  return {
    id: "dlc-pumped-cdu",
    name: "DLC compute — pumped CDU + air-liquid HEX",
    description:
      "Four GPU cold plates on a closed water loop, circulated by a CDU pump through a forced-convection air–liquid heat exchanger.",
    nodes: [
      {
        id: "tank",
        kind: "tank",
        name: "Expansion tank",
        x: 40,
        y: 470,
        z: 0.6,
        fluid: LIQ,
        params: { pFixed: DLC_TANK_P },
      },
      {
        id: "pump",
        kind: "pump",
        name: "CDU pump",
        x: 250,
        y: 470,
        z: 0.2,
        fluid: LIQ,
        params: { D: 0.025, L: 0, K: 1.5, pump: { coeffs: DLC_PUMP_COEFFS, hMin: 0 } },
      },
      {
        id: "filter",
        kind: "filter",
        name: "Y-strainer",
        x: 460,
        y: 470,
        z: 0.25,
        fluid: LIQ,
        params: { D: 0.02, L: 0.12, K: 3.5, eps: copper },
      },
      {
        id: "supplyManifold",
        kind: "junction",
        name: "Supply manifold",
        x: 700,
        y: 300,
        z: 0.3,
        fluid: LIQ,
        params: {},
      },
      gpu(0, 940, 160),
      gpu(1, 940, 250),
      gpu(2, 940, 340),
      gpu(3, 940, 430),
      {
        id: "returnManifold",
        kind: "junction",
        name: "Return manifold",
        x: 1160,
        y: 300,
        z: 0.3,
        fluid: LIQ,
        params: {},
      },
      {
        id: "hex",
        kind: "heatExchanger",
        name: "Air–liquid HEX",
        x: 540,
        y: 110,
        z: 0.4,
        fluid: LIQ,
        params: {
          ua: DLC_HEX_UA,
          arrangement: "crossflow-unmixed",
          liquidL: 1.1,
          liquidD: 0.014,
          liquidK: 8,
          airRQuad: 4200,
          airD: 0.2,
          airL: 0,
        },
      },
      {
        id: "airIn",
        kind: "boundary",
        name: "Ambient in",
        x: 40,
        y: 36,
        z: 0.4,
        fluid: AIR,
        params: { pFixed: DLC_AMBIENT_P, tFixed: DLC_AIR_TIN },
      },
      {
        id: "fan",
        kind: "fan",
        name: "HEX fans",
        x: 250,
        y: 36,
        z: 0.4,
        fluid: AIR,
        params: { D: 0.12, L: 0, K: 0.8, fan: { coeffs: DLC_FAN_COEFFS, dpMin: 0 } },
      },
      {
        id: "airOut",
        kind: "boundary",
        name: "Exhaust",
        x: 820,
        y: 36,
        z: 0.4,
        fluid: AIR,
        params: { pFixed: DLC_AMBIENT_P },
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
        geometry: { L: 0.8, D: 0.025, eps: copper, K: 0.5 },
      },
      {
        id: "e-pump-filter",
        name: "Discharge",
        from: { node: "pump", port: "out" },
        to: { node: "filter", port: "in" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 0.6, D: 0.025, eps: copper, K: 0.3 },
      },
      {
        id: "e-filter-supply",
        name: "Supply header",
        from: { node: "filter", port: "out" },
        to: { node: "supplyManifold", port: "port" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 4.5, D: 0.02, eps: copper, K: 1.2 },
      },
      ...[0, 1, 2, 3].flatMap((i) => [
        {
          id: `e-sup-gpu${i}`,
          name: `Branch ${i} supply`,
          from: { node: "supplyManifold", port: "port" as const },
          to: { node: `gpu${i}`, port: "in" as const },
          kind: "pipe" as const,
          fluid: LIQ,
          geometry: { L: 0.45, D: 0.008, eps: copper, K: 0.8 },
        },
        {
          id: `e-gpu${i}-ret`,
          name: `Branch ${i} return`,
          from: { node: `gpu${i}`, port: "out" as const },
          to: { node: "returnManifold", port: "port" as const },
          kind: "pipe" as const,
          fluid: LIQ,
          geometry: { L: 0.45, D: 0.008, eps: copper, K: 0.8 },
        },
      ]),
      {
        id: "e-ret-hex",
        name: "Return header",
        from: { node: "returnManifold", port: "port" },
        to: { node: "hex", port: "liqIn" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 3.8, D: 0.02, eps: copper, K: 1.0 },
      },
      {
        id: "e-hex-tank",
        name: "Cooled return",
        from: { node: "hex", port: "liqOut" },
        to: { node: "tank", port: "port" },
        kind: "pipe",
        fluid: LIQ,
        geometry: { L: 2.2, D: 0.02, eps: copper, K: 0.8 },
      },
      {
        id: "e-air-fan",
        name: "Fan inlet",
        from: { node: "airIn", port: "port" },
        to: { node: "fan", port: "in" },
        kind: "duct",
        fluid: AIR,
        geometry: { L: 0.25, D: 0.16, eps: 0, K: 0.4 },
      },
      {
        id: "e-fan-hex",
        name: "Fan to HEX",
        from: { node: "fan", port: "out" },
        to: { node: "hex", port: "airIn" },
        kind: "duct",
        fluid: AIR,
        geometry: { L: 0.2, D: 0.16, eps: 0, K: 0.3 },
      },
      {
        id: "e-hex-exh",
        name: "HEX exhaust",
        from: { node: "hex", port: "airOut" },
        to: { node: "airOut", port: "port" },
        kind: "duct",
        fluid: AIR,
        geometry: { L: 0.35, D: 0.16, eps: 0, K: 0.5 },
      },
    ],
  };
}

export function dlcPumpHeadM(Q: number): number {
  return Math.max(0, DLC_PUMP_COEFFS[0] + DLC_PUMP_COEFFS[2] * Q * Q);
}

export function fanDpPa(Q: number): number {
  return Math.max(0, DLC_FAN_COEFFS[0] + DLC_FAN_COEFFS[2] * Q * Q);
}

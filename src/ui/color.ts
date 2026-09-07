import type { SolveResult } from "../engine/types";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function tempColor(T: number, tMin = 298, tMax = 350): string {
  const t = Math.min(1, Math.max(0, (T - tMin) / (tMax - tMin)));
  // teal → brass → copper
  const r = Math.round(lerp(58, 224, t));
  const g = Math.round(lerp(215, 122, t));
  const b = Math.round(lerp(183, 72, t));
  return `rgb(${r}, ${g}, ${b})`;
}

export function fluidColor(fluid: string): string {
  return fluid.includes("air") ? "var(--air)" : "var(--coolant)";
}

export function domainOf(kind: string, fluid: string): "air" | "liquid" | "heat" {
  if (kind === "coldPlate" || kind === "heatExchanger") return "heat";
  if (fluid.includes("air") || kind === "fan") return "air";
  return "liquid";
}

export function resultForEquipment(
  id: string,
  result: SolveResult | null,
): { Q?: number; T?: number; P?: number; q?: number; Ts?: number } {
  if (!result) return {};
  const core = result.links[`${id}.core`];
  const hx = result.couplings[`${id}.hx`];
  const node = result.nodes[id];
  if (hx) return { q: hx.q, T: hx.T_hot_in };
  if (core)
    return {
      Q: core.Q,
      q: core.q,
      Ts: core.T_surface,
      T: core.T_out,
    };
  if (node) return { P: node.P, T: node.T };
  return {};
}

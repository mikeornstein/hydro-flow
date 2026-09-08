import type { DiagramNode } from "../../diagram/types";
import type { LinkResult, SolveResult } from "../../engine/types";
import {
  formatFlowAir,
  formatFlowLiquid,
  formatPower,
  formatTempC,
} from "../../engine/units";

/**
 * Resolve the solver link that backs a canvas equipment node.
 * Pinned projects keep original link ids; compiled diagrams use `${node.id}.core`.
 */
export function linkResultForEquipment(
  node: DiagramNode,
  result: SolveResult,
): LinkResult | undefined {
  if (node.sourceLinkId) {
    const pinned = result.links[node.sourceLinkId];
    if (pinned) return pinned;
  }
  return result.links[`${node.id}.core`] ?? result.links[node.id];
}

export function equipmentReadout(node: DiagramNode, result: SolveResult | null): string {
  if (!result) return "unsolved";
  if (node.kind === "coldPlate") {
    const L = linkResultForEquipment(node, result);
    if (!L?.T_surface) return "—";
    return `${formatTempC(L.T_surface)}  ·  ${formatPower(L.q ?? 0)}`;
  }
  if (node.kind === "heatExchanger") {
    const hx = result.couplings[`${node.id}.hx`];
    if (!hx) return "—";
    return `${formatPower(hx.q)}  ·  ε ${hx.effectiveness.toFixed(2)}`;
  }
  if (node.kind === "pump") {
    const L = linkResultForEquipment(node, result);
    return L ? formatFlowLiquid(L.Q) : "—";
  }
  if (node.kind === "fan") {
    const L = linkResultForEquipment(node, result);
    return L ? formatFlowAir(L.Q) : "—";
  }
  if (
    node.kind === "orifice" ||
    node.kind === "valve" ||
    node.kind === "filter"
  ) {
    const L = linkResultForEquipment(node, result);
    if (L) return formatFlowLiquid(L.Q);
  }
  const n = result.nodes[node.id] ?? result.nodes[`${node.id}.in`];
  if (n) return formatTempC(n.T);
  return "—";
}

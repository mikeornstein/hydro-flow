import type { Edge, Node } from "@xyflow/react";
import { bundleSlots } from "../../diagram/bundleOffset";
import type { Diagram } from "../../diagram/types";
import type { SolveResult } from "../../engine/types";
import type { EquipData } from "./EquipmentNode";
import type { FlowEdgeData } from "./FlowEdge";

export function toFlow(diagram: Diagram, result: SolveResult | null, selectedId: string | null) {
  const nodes: Node<EquipData>[] = diagram.nodes.map((n) => ({
    id: n.id,
    type: "equipment",
    position: { x: n.x, y: n.y },
    data: { node: n, result, selected: selectedId === n.id },
    selected: selectedId === n.id,
  }));
  const slots = bundleSlots(
    diagram.edges.map((e) => ({ id: e.id, from: e.from.node, to: e.to.node })),
  );
  const edges: Edge<FlowEdgeData>[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.from.node,
    target: e.to.node,
    sourceHandle: e.from.port,
    targetHandle: e.to.port,
    type: "flow",
    animated: Boolean(result),
    data: {
      edge: e,
      result,
      selected: selectedId === e.id,
      bundleOffset: slots.get(e.id)?.offset ?? 0,
      bundleSize: slots.get(e.id)?.size ?? 1,
    },
    selected: selectedId === e.id,
  }));
  return { nodes, edges };
}

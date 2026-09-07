import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { DiagramEdge } from "../../diagram/types";
import type { SolveResult } from "../../engine/types";
import { tempColor } from "../color";
import { formatFlowAir, formatFlowLiquid, formatTempC } from "../../engine/units";

export type FlowEdgeData = {
  edge: DiagramEdge;
  result: SolveResult | null;
  selected: boolean;
};

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const { edge, result, selected } = (data ?? {}) as FlowEdgeData;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const link = result?.links[edge?.id];
  const air = edge?.fluid?.includes("air");
  const stroke = link?.T_out ? tempColor(link.T_out) : air ? "#7eb3ff" : "#3ad7b7";
  const label = link
    ? `${air ? formatFlowAir(link.Q) : formatFlowLiquid(link.Q)}${link.T_out ? " · " + formatTempC(link.T_out) : ""}`
    : edge?.name ?? "";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: selected ? 3.2 : 2.1,
          opacity: 0.92,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`edge-label ${selected ? "is-selected" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

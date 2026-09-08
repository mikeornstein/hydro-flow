import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { BUNDLE_LABEL_MAX, offsetQuadPath } from "../../diagram/bundleOffset";
import type { DiagramEdge } from "../../diagram/types";
import type { SolveResult } from "../../engine/types";
import { tempColor } from "../color";
import { formatFlowAir, formatFlowLiquid, formatTempC } from "../../engine/units";

export type FlowEdgeData = {
  edge: DiagramEdge;
  result: SolveResult | null;
  selected: boolean;
  bundleOffset: number;
  bundleSize: number;
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
  const { edge, result, selected, bundleOffset = 0, bundleSize = 1 } = (data ??
    {}) as FlowEdgeData;
  let path: string;
  let labelX: number;
  let labelY: number;
  if (bundleOffset === 0) {
    [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
  } else {
    ({ path, labelX, labelY } = offsetQuadPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      bundleOffset,
    ));
  }
  const link = result?.links[edge?.id];
  const air = edge?.fluid?.includes("air");
  const stroke = link?.T_out ? tempColor(link.T_out) : air ? "#7eb3ff" : "#3ad7b7";
  const label = link
    ? `${air ? formatFlowAir(link.Q) : formatFlowLiquid(link.Q)}${link.T_out ? " · " + formatTempC(link.T_out) : ""}`
    : edge?.name ?? "";
  const showLabel = Boolean(label) && (selected || bundleSize <= BUNDLE_LABEL_MAX);

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
      {showLabel && (
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
      )}
    </>
  );
}

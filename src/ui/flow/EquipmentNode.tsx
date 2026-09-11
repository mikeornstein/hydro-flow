import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiagramNode, PortId } from "../../diagram/types";
import type { SolveResult } from "../../engine/types";
import { domainOf } from "../color";
import { equipmentReadout } from "./equipmentReadout";

export type EquipData = {
  node: DiagramNode;
  result: SolveResult | null;
  selected: boolean;
};

const PORTS: Record<string, { id: PortId; type: "source" | "target"; pos: Position }[]> = {
  junction: [
    { id: "port", type: "target", pos: Position.Left },
    { id: "port", type: "source", pos: Position.Right },
  ],
  boundary: [
    { id: "port", type: "target", pos: Position.Left },
    { id: "port", type: "source", pos: Position.Right },
  ],
  tank: [
    { id: "port", type: "target", pos: Position.Left },
    { id: "port", type: "source", pos: Position.Right },
  ],
  pump: [
    { id: "in", type: "target", pos: Position.Left },
    { id: "out", type: "source", pos: Position.Right },
  ],
  fan: [
    { id: "in", type: "target", pos: Position.Left },
    { id: "out", type: "source", pos: Position.Right },
  ],
  valve: [
    { id: "in", type: "target", pos: Position.Left },
    { id: "out", type: "source", pos: Position.Right },
  ],
  filter: [
    { id: "in", type: "target", pos: Position.Left },
    { id: "out", type: "source", pos: Position.Right },
  ],
  orifice: [
    { id: "in", type: "target", pos: Position.Left },
    { id: "out", type: "source", pos: Position.Right },
  ],
  coldPlate: [
    { id: "in", type: "target", pos: Position.Left },
    { id: "out", type: "source", pos: Position.Right },
  ],
  radiator: [
    { id: "in", type: "target", pos: Position.Left },
    { id: "out", type: "source", pos: Position.Right },
  ],
  heatExchanger: [
    { id: "liqIn", type: "target", pos: Position.Left },
    { id: "liqOut", type: "source", pos: Position.Bottom },
    { id: "airIn", type: "target", pos: Position.Top },
    { id: "airOut", type: "source", pos: Position.Right },
  ],
};

function Glyph({ kind }: { kind: string }) {
  const sw = 22;
  const sh = 22;
  const s = { width: sw, height: sh, viewBox: "0 0 24 24", fill: "none" as const };
  switch (kind) {
    case "pump":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 12.5 L16 8 L16 16 Z" fill="currentColor" />
        </svg>
      );
    case "fan":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 12 L18 10.5 A6.2 6.2 0 0 0 12 6 Z M12 12 L13.5 18 A6.2 6.2 0 0 0 18 13.5 Z M12 12 L6 13.5 A6.2 6.2 0 0 0 12 18 Z M12 12 L10.5 6 A6.2 6.2 0 0 0 6 10.5 Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    case "coldPlate":
      return (
        <svg {...s}>
          <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 9 H17 M7 12 H17 M7 15 H17" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "heatExchanger":
      return (
        <svg {...s}>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 8 V16 M10 8 V16 M13 8 V16 M16 8 V16" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "radiator":
      return (
        <svg {...s}>
          <rect x="3.5" y="6" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M1.5 9 H15.5 a1.75 1.75 0 0 1 0 3.5 H8.5 a1.75 1.75 0 0 0 0 3.5 H22.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path d="M8 2.5 q1 1 0 2 M12 2.5 q1 1 0 2 M16 2.5 q1 1 0 2" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </svg>
      );
    case "tank":
      return (
        <svg {...s}>
          <path
            d="M7 7 H17 V16 A5 3 0 0 1 7 16 Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M7 10 H17" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
        </svg>
      );
    case "filter":
      return (
        <svg {...s}>
          <path d="M5 7 H19 L12 17 Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 10 H15" stroke="currentColor" />
        </svg>
      );
    case "valve":
      return (
        <svg {...s}>
          <path d="M5 8 L11 12 L5 16 Z M19 8 L13 12 L19 16 Z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "orifice":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        </svg>
      );
    case "boundary":
      return (
        <svg {...s}>
          <path d="M6 6 V18 M6 12 H18" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    default:
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      );
  }
}

export function EquipmentNode({ data }: NodeProps) {
  const { node, result, selected } = data as EquipData;
  const domain = domainOf(node.kind, node.fluid);
  const ports = PORTS[node.kind] ?? PORTS.junction;
  return (
    <div className={`equip domain-${domain} ${selected ? "is-selected" : ""} kind-${node.kind}`}>
      {ports.map((p) => (
        <Handle
          key={`${p.type}-${p.id}-${p.pos}`}
          id={p.id}
          type={p.type}
          position={p.pos}
          className={`port port-${node.fluid.includes("air") && p.id.startsWith("air") ? "air" : p.id.startsWith("liq") || p.id === "in" || p.id === "out" || p.id === "port" ? (node.fluid.includes("air") ? "air" : "liq") : "liq"}`}
        />
      ))}
      <div className="equip-head">
        <span className="equip-glyph">
          <Glyph kind={node.kind} />
        </span>
        <div>
          <div className="equip-kicker">{node.kind}</div>
          <div className="equip-name">{node.name}</div>
        </div>
      </div>
      <div className="equip-readout">{equipmentReadout(node, result)}</div>
    </div>
  );
}

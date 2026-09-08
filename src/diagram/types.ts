import type { Fluid, HeadPoint, LossModel, PressurePoint } from "../engine/types";

export type EquipmentKind =
  | "junction"
  | "boundary"
  | "tank"
  | "pump"
  | "fan"
  | "valve"
  | "filter"
  | "orifice"
  | "coldPlate"
  | "heatExchanger";

export type PortId =
  | "port"
  | "in"
  | "out"
  | "liqIn"
  | "liqOut"
  | "airIn"
  | "airOut";

export interface PumpParams {
  coeffs?: number[];
  hMin?: number;
  /** Pasted H(Q) samples; override `coeffs` when present. */
  table?: HeadPoint[];
}

export interface FanParams {
  coeffs?: number[];
  dpMin?: number;
  /** Pasted ΔP(Q) samples; override `coeffs` when present. */
  table?: PressurePoint[];
}

export interface EquipmentParams {
  fluid?: string;
  pFixed?: number;
  tFixed?: number;
  z?: number;
  K?: number;
  opening?: number;
  q?: number;
  rTh?: number;
  L?: number;
  D?: number;
  eps?: number;
  A?: number;
  rQuad?: number;
  rLin?: number;
  lossModel?: LossModel;
  pump?: PumpParams;
  fan?: FanParams;
  /** Pasted Δp(Q) loss samples added to the equipment's own loss. */
  dpTable?: PressurePoint[];
  ua?: number;
  arrangement?: "counterflow" | "parallel" | "crossflow-unmixed";
  liquidK?: number;
  liquidL?: number;
  liquidD?: number;
  airK?: number;
  airL?: number;
  airD?: number;
  airRQuad?: number;
}

export interface DiagramNode {
  id: string;
  kind: EquipmentKind;
  name: string;
  x: number;
  y: number;
  z: number;
  fluid: string;
  params: EquipmentParams;
  /**
   * When this canvas node was expanded from a Project link, the original link
   * id used in pinned SolveResult.links (e.g. "hs-1" for node "eq:hs-1").
   */
  sourceLinkId?: string;
}

export interface DiagramEdge {
  id: string;
  name?: string;
  from: { node: string; port: PortId };
  to: { node: string; port: PortId };
  kind: "pipe" | "duct" | "connector";
  fluid: string;
  geometry: { L: number; D: number; eps: number; K: number };
  /** Pasted Δp(Q) loss samples added to the run's friction and K. */
  dpTable?: PressurePoint[];
}

export interface Diagram {
  id: string;
  name: string;
  description: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** Custom fluids carried from a Project so recompile after unpin still resolves. */
  fluids?: Record<string, Fluid>;
}

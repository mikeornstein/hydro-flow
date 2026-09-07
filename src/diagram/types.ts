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
  coeffs: number[];
  hMin?: number;
}

export interface FanParams {
  coeffs: number[];
  dpMin?: number;
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
  rQuad?: number;
  rLin?: number;
  pump?: PumpParams;
  fan?: FanParams;
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
}

export interface DiagramEdge {
  id: string;
  name?: string;
  from: { node: string; port: PortId };
  to: { node: string; port: PortId };
  kind: "pipe" | "duct" | "connector";
  fluid: string;
  geometry: { L: number; D: number; eps: number; K: number };
}

export interface Diagram {
  id: string;
  name: string;
  description: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** SI constants used throughout the engine. */
export const G = 9.80665;
export const P_ATM = 101325;
export const SIGMA_SB = 5.670374419e-8;

export type NodeKind = "junction" | "boundary" | "tank";

export type LinkType =
  | "pipe"
  | "duct"
  | "orifice"
  | "valve"
  | "pump"
  | "fan"
  | "filter"
  | "generic-resistance"
  | "cold-plate"
  | "hex-stream"
  | "logical";

export type LossModel = "darcy-weisbach" | "k-factor" | "quadratic" | "linear";

export type HexArrangement =
  | "counterflow"
  | "parallel"
  | "crossflow-unmixed";

export type AnalysisType = "steady";
export type FlowRegime = "incompressible";

export interface Fluid {
  id: string;
  name: string;
  phase: "liquid" | "gas";
  /** kg/m³ */
  rho: number;
  /** Pa·s */
  mu: number;
  /** J/(kg·K) */
  cp: number;
  /** W/(m·K) */
  k: number;
  /** 1/K */
  beta: number;
  /** K, property reference */
  Tref: number;
}

export interface Convergence {
  massResidual: number;
  energyResidual: number;
  maxIter: number;
  relaxationP: number;
  relaxationQ: number;
}

export interface AnalysisSettings {
  type: AnalysisType;
  flowRegime: FlowRegime;
  energy: boolean;
  gravity: boolean;
  convergence: Convergence;
}

export interface UnitPrefs {
  system: "SI" | "IP";
  length: "m" | "mm" | "in" | "ft";
  pressure: "Pa" | "kPa" | "bar" | "psi";
  flow: "m3/s" | "L/min" | "gpm" | "cfm";
  temperature: "K" | "C" | "F";
  power: "W" | "kW";
}

export interface ProjectMeta {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface NodeDef {
  id: string;
  kind: NodeKind;
  name?: string;
  x: number;
  y: number;
  /** elevation, m */
  z: number;
  fluid: string;
  /** Absolute pressure, Pa. Required for boundary/tank. */
  pFixed?: number;
  /** Temperature, K. Optional energy BC. */
  tFixed?: number;
  /** Mass source into the node, kg/s (positive = injection). */
  mdotSource?: number;
  /** Heat into the node, W. */
  qSource?: number;
}

export interface PumpCurve {
  /** Head H(Q) = c0 + c1 Q + c2 Q² + … with Q in m³/s, H in m. */
  coeffs: number[];
  /** Optional shutoff clamp, m. */
  hMin?: number;
}

export interface FanCurve {
  /** Pressure rise ΔP(Q) = c0 + c1 Q + c2 Q² + … Pa, Q in m³/s. */
  coeffs: number[];
  dpMin?: number;
}

export interface LinkComponent {
  type: LinkType;
  lossModel: LossModel;
  geometry: {
    L: number;
    D: number;
    eps: number;
    /** Elevation change z_to − z_from if not taken from nodes. */
    dZ?: number;
    /** Optional flow area (m²). When set, V = Q/A while D remains the hydraulic diameter. */
    A?: number;
  };
  /** Minor-loss K based on velocity in D. */
  K: number;
  /** Lumped quadratic ΔP = rQuad * Q * |Q|, Pa. */
  rQuad?: number;
  /** Lumped linear ΔP = rLin * Q, Pa. */
  rLin?: number;
  /** Valve opening 0–1. K_eff = K / opening². */
  opening?: number;
  pump?: PumpCurve;
  fan?: FanCurve;
  /** Heat into the fluid, W (cold plates, heaters). */
  q?: number;
  /** Case-to-coolant thermal resistance, K/W. */
  rTh?: number;
  /** Parallel identical paths. Flow on the link is the total. */
  parallelCount?: number;
}

export interface LinkDef {
  id: string;
  name?: string;
  from: string;
  to: string;
  fluid: string;
  component: LinkComponent;
}

export interface HexCoupling {
  id: string;
  name?: string;
  type: "hex";
  hotLinkId: string;
  coldLinkId: string;
  /** Overall UA, W/K. */
  ua: number;
  arrangement: HexArrangement;
}

export interface Project {
  version: "0.1.0";
  meta: ProjectMeta;
  units: UnitPrefs;
  fluids: Record<string, Fluid>;
  analysis: AnalysisSettings;
  nodes: NodeDef[];
  links: LinkDef[];
  couplings: HexCoupling[];
}

export type SolveStatus =
  | "converged"
  | "diverged"
  | "max-iter"
  | "singular";

export interface NodeResult {
  P: number;
  T: number;
  H?: number;
}

export interface LinkResult {
  Q: number;
  mdot: number;
  dP: number;
  V: number;
  Re: number;
  f?: number;
  q?: number;
  T_in?: number;
  T_out?: number;
  /** Surface / case temperature when rTh is set, K. */
  T_surface?: number;
}

export interface CouplingResult {
  q: number;
  effectiveness: number;
  ntu: number;
  Cmin: number;
  Cr: number;
  T_hot_in: number;
  T_hot_out: number;
  T_cold_in: number;
  T_cold_out: number;
}

export interface SolveResult {
  status: SolveStatus;
  iterations: number;
  energyIterations: number;
  residuals: number[];
  energyResidual: number;
  nodes: Record<string, NodeResult>;
  links: Record<string, LinkResult>;
  couplings: Record<string, CouplingResult>;
  warnings: string[];
  elapsedMs: number;
}

export const DEFAULT_CONVERGENCE: Convergence = {
  massResidual: 1e-10,
  energyResidual: 1e-8,
  maxIter: 80,
  relaxationP: 0.85,
  relaxationQ: 0.7,
};

export const DEFAULT_UNITS: UnitPrefs = {
  system: "SI",
  length: "m",
  pressure: "kPa",
  flow: "L/min",
  temperature: "C",
  power: "W",
};

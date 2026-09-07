/**
 * Core data model for hydro-flow Flow Network Modeling (FNM).
 * Mirrors the v0.1 project JSON in docs/MACROFLOW_RESEARCH.md (section 11).
 * All quantities are stored in SI internally (Pa, m, m^3/s, K).
 */

export type NodeKind = "junction" | "boundary" | "tank" | "plenum";

export interface FlowNode {
  id: string;
  kind: NodeKind;
  /** Schematic canvas position (also used for elevation via z). */
  x?: number;
  y?: number;
  /** Elevation in metres. Used for gravity / hydrostatic head. */
  z?: number;
  /** Fixed static pressure boundary condition, Pa (boundary/tank nodes). */
  pFixed?: number;
  /** Fixed temperature boundary condition, K. */
  tFixed?: number;
  /** External demand (outflow positive) in m^3/s at this node. */
  demand?: number;
}

export type LossModel =
  | "darcy-weisbach"
  | "hazen-williams"
  | "k-factor"
  | "curve";

export interface PipeGeometry {
  /** Length, m. */
  L: number;
  /** Internal diameter, m. */
  D: number;
  /** Absolute roughness, m (Darcy–Weisbach). */
  eps?: number;
  /** Hazen–Williams roughness coefficient (dimensionless). */
  C?: number;
}

/** Pump/fan rise curve Hp(Q) = a + b*Q + c*Q^2 (Pa, Q in m^3/s). */
export interface PumpCurve {
  a: number;
  b?: number;
  c?: number;
}

export interface Component {
  type:
    | "pipe"
    | "duct"
    | "elbow"
    | "tee"
    | "orifice"
    | "valve"
    | "pump"
    | "fan"
    | "filter"
    | "generic-resistance"
    | "emitter"
    | "sprinkler"
    | "lateral";
  geometry?: PipeGeometry;
  lossModel?: LossModel;
  /** Minor-loss coefficient (dimensionless). */
  K?: number;
  /** Pump/fan pressure-rise curve. */
  pump?: PumpCurve;
}

export interface FlowLink {
  id: string;
  from: string;
  to: string;
  component: Component;
}

export interface FluidModel {
  id: string;
  name?: string;
  model?: "constant";
  /** Density, kg/m^3. */
  rho: number;
  /** Dynamic viscosity, Pa·s. */
  mu: number;
  cp?: number;
  k?: number;
}

export interface Convergence {
  massResidual?: number;
  maxIter?: number;
  relaxationP?: number;
}

export interface Analysis {
  type?: "steady";
  flowRegime?: "incompressible";
  energy?: boolean;
  gravity?: boolean;
  convergence?: Convergence;
}

export interface Project {
  version?: string;
  meta?: { name?: string; description?: string };
  fluid: FluidModel;
  analysis?: Analysis;
  nodes: FlowNode[];
  links: FlowLink[];
}

export type Status =
  | "converged"
  | "diverged"
  | "max-iter"
  | "singular";

export interface NodeResult {
  /** Static pressure, Pa. */
  P: number;
  /** Piezometric head expressed as pressure, Pa (P + rho*g*z). */
  H: number;
  T?: number;
}

export interface LinkResult {
  /** Volumetric flow, m^3/s (positive from → to). */
  Q: number;
  /** Mass flow, kg/s. */
  mdot: number;
  /** Pressure drop across the resistance, Pa (friction + minor). */
  dP: number;
  /** Velocity, m/s. */
  V: number;
  /** Reynolds number. */
  Re: number;
  /** Darcy friction factor (pipes). */
  f?: number;
  /** Pump/fan pressure rise, Pa. */
  pumpRise?: number;
}

export interface SolveResult {
  status: Status;
  iterations: number;
  residuals: number[];
  nodes: Record<string, NodeResult>;
  links: Record<string, LinkResult>;
  warnings: string[];
  elapsedMs: number;
}

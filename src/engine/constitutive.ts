import { dpTableLossPa, sortedByQ, tableRange, type QPoint } from "./curve";
import { darcyWeisbach } from "./friction";
import { G } from "./types";
import type { EmitterLaw, Fluid, LinkDef, NodeDef } from "./types";
import { fanCurveRisePa, pumpCurveHeadM } from "./thermo";

/** Inverse of Q = k ΔP^x. Odd in Q so reverse flow meets the same resistance. */
export function emitterDropPa(law: EmitterLaw, Q: number): number {
  return Math.sign(Q) * Math.pow(Math.abs(Q) / law.k, 1 / law.x);
}

export interface ConstitutiveEval {
  /** P_from − P_to = loss + elev − rise, Pa. */
  dP: number;
  /** Friction, K, lumped R, emitter. No tee (solver adds that). */
  loss: number;
  elev: number;
  rise: number;
  f?: number;
  Re: number;
  V: number;
  D: number;
}

function pathCount(link: LinkDef): number {
  return Math.max(1, link.component.parallelCount ?? 1);
}

function openingK(link: LinkDef): number {
  const K = link.component.K;
  if (link.component.type !== "valve") return K;
  const o = Math.max(link.component.opening ?? 1, 1e-4);
  return K / (o * o);
}

/**
 * Pressure drop P_from − P_to as a function of total volumetric flow Q
 * (from → to positive). Includes elevation, pump/fan rise, and losses.
 */
export function linkDeltaP(
  link: LinkDef,
  Qtotal: number,
  fluid: Fluid,
  nodes: Record<string, NodeDef>,
  gravity: boolean,
): ConstitutiveEval {
  const n = pathCount(link);
  const Q = Qtotal / n;
  const c = link.component;
  const D = c.geometry.D;
  const from = nodes[link.from];
  const to = nodes[link.to];
  const dZ =
    c.geometry.dZ !== undefined ? c.geometry.dZ : gravity ? to.z - from.z : 0;
  const elev = gravity ? fluid.rho * G * dZ : 0;

  let loss = 0;
  let f: number | undefined;
  let Re = 0;
  let V = 0;

  if (c.rLin) loss += c.rLin * Q;
  if (c.rQuad) loss += c.rQuad * Q * Math.abs(Q);

  const K = openingK(link);
  const useDarcy =
    c.lossModel === "darcy-weisbach" ||
    (c.geometry.L > 0 && c.lossModel !== "quadratic" && c.lossModel !== "linear");

  if (useDarcy && D > 0) {
    const dw = darcyWeisbach({
      Q,
      L: c.geometry.L,
      D,
      eps: c.geometry.eps,
      rho: fluid.rho,
      mu: fluid.mu,
      K,
      A: c.geometry.A,
    });
    loss += dw.dp;
    f = dw.f;
    Re = dw.Re;
    V = dw.V;
  } else if (K !== 0 && D > 0) {
    const dw = darcyWeisbach({
      Q,
      L: 0,
      D,
      eps: 0,
      rho: fluid.rho,
      mu: fluid.mu,
      K,
      A: c.geometry.A,
    });
    loss += dw.dp;
    Re = dw.Re;
    V = dw.V;
  } else if (D > 0) {
    const A = c.geometry.A ?? 0.25 * Math.PI * D * D;
    V = Q / A;
    Re = (fluid.rho * Math.abs(V) * D) / fluid.mu;
  }

  if (c.emitter) loss += emitterDropPa(c.emitter, Q);
  if (c.dpTable) loss += dpTableLossPa(c.dpTable, Q);

  let rise = 0;
  if (c.pump) rise += fluid.rho * G * pumpCurveHeadM(c.pump, Q);
  if (c.fan) rise += fanCurveRisePa(c.fan, Q);

  return { dP: loss + elev - rise, loss, elev, rise, f, Re, V, D };
}

function fmtQ(Q: number): string {
  return `${Q.toPrecision(3)} m³/s`;
}

/**
 * One note per user table on this link that the solved per-path flow left
 * outside its samples. Empty when every table covers Q. Evaluated once after
 * the solve so Newton iterates never produce warnings.
 */
export function curveTableNotes(link: LinkDef, Qtotal: number): string[] {
  const c = link.component;
  const Q = Qtotal / pathCount(link);
  const notes: string[] = [];
  const clampNote = (label: string, table: readonly QPoint[], q: number, held: string) => {
    const range = tableRange(table, q);
    if (range === "in") return;
    if (q < 0) {
      notes.push(`${label}: Q = ${fmtQ(q)} runs the machine backwards; shutoff value plus a quadratic reverse loss applied`);
      return;
    }
    const sorted = sortedByQ(table);
    const edge = range === "below" ? sorted[0] : sorted[sorted.length - 1];
    const which = range === "below" ? "first" : "last";
    notes.push(
      `${label}: Q = ${fmtQ(q)} is ${range} its ${which} sample (${fmtQ(edge.Q)}); ${held}`,
    );
  };
  if (c.pump?.table) clampNote("pump table", c.pump.table, Q, "head held at that sample");
  if (c.fan?.table) clampNote("fan table", c.fan.table, Q, "rise held at that sample");
  if (c.dpTable) {
    const q = Math.abs(Q);
    const range = tableRange(c.dpTable, q);
    if (range === "above") {
      clampNote("Δp table", c.dpTable, q, "loss held at that sample");
    } else if (range === "below") {
      clampNote("Δp table", c.dpTable, q, "loss taken linear to the origin");
    }
  }
  return notes;
}

export function dDp_dQ(
  link: LinkDef,
  Qtotal: number,
  fluid: Fluid,
  nodes: Record<string, NodeDef>,
  gravity: boolean,
): number {
  const scale = Math.max(1e-8, 1e-5 * Math.abs(Qtotal));
  const plus = linkDeltaP(link, Qtotal + scale, fluid, nodes, gravity).dP;
  const minus = linkDeltaP(link, Qtotal - scale, fluid, nodes, gravity).dP;
  const deriv = (plus - minus) / (2 * scale);
  // Keep the Jacobian invertible at Q ≈ 0 for pure quadratic devices.
  const floor = fluid.phase === "gas" ? 1e2 : 1e4;
  return deriv >= 0 ? Math.max(deriv, floor) : Math.min(deriv, -floor);
}

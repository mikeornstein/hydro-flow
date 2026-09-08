import { darcyWeisbach } from "./friction";
import { G } from "./types";
import type { EmitterLaw, Fluid, LinkDef, NodeDef } from "./types";
import { fanRisePa, pumpHeadM } from "./thermo";

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

  let rise = 0;
  if (c.pump) {
    rise += fluid.rho * G * pumpHeadM(c.pump.coeffs, Q, c.pump.hMin ?? 0);
  }
  if (c.fan) {
    rise += fanRisePa(c.fan.coeffs, Q, c.fan.dpMin ?? 0);
  }

  return { dP: loss + elev - rise, loss, elev, rise, f, Re, V, D };
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

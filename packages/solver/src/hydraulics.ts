import type { Component, FluidModel } from "./types.js";

export const G = 9.80665; // m/s^2

export interface LinkPhysics {
  area: number; // m^2
  /** Signed resistance head loss as pressure, Pa, as a function of Q (m^3/s). */
  headloss: (q: number) => number;
  /** d(headloss)/dQ, Pa·s/m^3. */
  dHeadloss: (q: number) => number;
  /** Pump/fan pressure rise, Pa, at flow q. */
  pumpRise: (q: number) => number;
  frictionFactor: (q: number) => number;
  reynolds: (q: number) => number;
}

/** Darcy friction factor: Hagen–Poiseuille (laminar) or Swamee–Jain (turbulent). */
export function frictionFactor(re: number, relRoughness: number): number {
  if (re < 1e-9) return 0;
  if (re < 2000) return 64 / re;
  const term = relRoughness / 3.7 + 5.74 / Math.pow(re, 0.9);
  const f = 0.25 / Math.pow(Math.log10(term), 2);
  if (re < 4000) {
    // Blend laminar and turbulent across the transition band.
    const fl = 64 / re;
    const w = (re - 2000) / 2000;
    return fl * (1 - w) + f * w;
  }
  return f;
}

const MIN_AREA = 1e-9;

export function buildLinkPhysics(
  component: Component,
  fluid: FluidModel,
): LinkPhysics {
  const { rho, mu } = fluid;
  const geom = component.geometry;
  const D = geom?.D ?? 0.05;
  const L = geom?.L ?? 0;
  const eps = geom?.eps ?? 0;
  const area = Math.max(Math.PI * (D * D) / 4, MIN_AREA);
  const K = component.K ?? 0;
  const pump = component.pump;

  const reynolds = (q: number): number => {
    const v = q / area;
    return (rho * Math.abs(v) * D) / mu;
  };

  const ff = (q: number): number => frictionFactor(reynolds(q), eps / D);

  // Resistance headloss magnitude coefficient for the turbulent/minor part.
  // dP = (f * L/D + K) * rho/2 * v * |v|
  const headloss = (q: number): number => {
    const v = q / area;
    const f = ff(q);
    const coeff = (f * (L / D) + K) * (rho / 2);
    return coeff * v * Math.abs(v);
  };

  const dHeadloss = (q: number): number => {
    // Numerical derivative is robust across laminar/turbulent transition and
    // handles the |v| kink. A small guard keeps the Jacobian well-conditioned.
    const scale = Math.max(Math.abs(q), 1e-6);
    const h = 1e-6 * scale;
    const d = (headloss(q + h) - headloss(q - h)) / (2 * h);
    return Math.max(d, 1e-3);
  };

  const pumpRise = (q: number): number => {
    if (!pump) return 0;
    const { a, b = 0, c = 0 } = pump;
    return a + b * q + c * q * q;
  };

  return {
    area,
    headloss: (q) => headloss(q) - pumpRise(q),
    dHeadloss: (q) => {
      let d = dHeadloss(q);
      if (pump) {
        const { b = 0, c = 0 } = pump;
        d -= b + 2 * c * q; // subtract pump slope
      }
      return Math.max(d, 1e-3);
    },
    pumpRise,
    frictionFactor: ff,
    reynolds,
  };
}

/**
 * Invert the link equation headloss(Q) = dh for Q, given a target head
 * difference dh (Pa). Monotonic in Q, so Newton with bisection fallback.
 */
export function solveLinkFlow(phys: LinkPhysics, dh: number): number {
  let q = 0;
  for (let i = 0; i < 60; i++) {
    const r = phys.headloss(q) - dh;
    if (Math.abs(r) < 1e-9) break;
    const d = phys.dHeadloss(q);
    let step = r / d;
    // Damp large steps for stability far from the root.
    const maxStep = 1 + Math.abs(q) * 10;
    if (Math.abs(step) > maxStep) step = Math.sign(step) * maxStep;
    q -= step;
  }
  return q;
}

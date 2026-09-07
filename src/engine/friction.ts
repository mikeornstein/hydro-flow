/**
 * Darcy friction factor via Churchill (1977), valid for all Re.
 * Returns Darcy f (4× Fanning).
 */
export function frictionFactorChurchill(Re: number, relRough: number): number {
  const R = Math.max(Re, 1e-12);
  const rr = Math.max(relRough, 0);
  const inv = Math.pow(7 / R, 0.9) + 0.27 * rr;
  const A = Math.pow(2.457 * Math.log(1 / inv), 16);
  const B = Math.pow(37530 / R, 16);
  return 8 * Math.pow(Math.pow(8 / R, 12) + 1 / Math.pow(A + B, 1.5), 1 / 12);
}

/** Smooth-pipe Blasius (Darcy), turbulent. */
export function frictionFactorBlasius(Re: number): number {
  return 0.3164 / Math.pow(Math.max(Re, 1), 0.25);
}

export function areaFromD(D: number): number {
  return 0.25 * Math.PI * D * D;
}

export interface DarcyResult {
  dp: number;
  f: number;
  Re: number;
  V: number;
}

/**
 * Signed Darcy–Weisbach + minor loss:
 * Δp = (f L/D + K) ρ V |V| / 2
 * At vanishing Re this recovers Hagen–Poiseuille.
 */
export function darcyWeisbach(args: {
  Q: number;
  L: number;
  D: number;
  eps: number;
  rho: number;
  mu: number;
  K?: number;
}): DarcyResult {
  const { Q, L, D, eps, rho, mu, K = 0 } = args;
  if (D <= 0) throw new Error("D must be positive");
  const A = areaFromD(D);
  const V = Q / A;
  const Re = (rho * Math.abs(V) * D) / mu;
  const f = frictionFactorChurchill(Re, eps / D);
  const dp = (f * (L / D) + K) * rho * V * Math.abs(V) * 0.5;
  return { dp, f, Re, V };
}

/** Laminar Hagen–Poiseuille closed form, Δp = 128 μ L Q / (π D⁴). */
export function hagenPoiseuille(Q: number, L: number, D: number, mu: number): number {
  return (128 * mu * L * Q) / (Math.PI * D ** 4);
}

export function reynolds(Q: number, D: number, rho: number, mu: number): number {
  const V = Q / areaFromD(D);
  return (rho * Math.abs(V) * D) / mu;
}

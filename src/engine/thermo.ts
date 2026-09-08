import { interpTable, pressureOf } from "./curve";
import type { FanCurve, HeadPoint, HexArrangement, PumpCurve } from "./types";

export function polyval(coeffs: number[], x: number): number {
  let y = 0;
  let p = 1;
  for (const c of coeffs) {
    y += c * p;
    p *= x;
  }
  return y;
}

/** Pump / fan curve in the forward quadrant; reverse flow gets shutoff + quadratic loss. */
export function pumpHeadM(coeffs: number[], Q: number, hMin = 0): number {
  if (Q >= 0) return Math.max(hMin, polyval(coeffs, Q));
  const h0 = Math.max(hMin, polyval(coeffs, 0));
  return h0 - 8e8 * Q * Q;
}

export function fanRisePa(coeffs: number[], Q: number, dpMin = 0): number {
  if (Q >= 0) return Math.max(dpMin, polyval(coeffs, Q));
  const dp0 = Math.max(dpMin, polyval(coeffs, 0));
  return dp0 - 2e6 * Q * Q;
}

const headOf = (p: HeadPoint): number => p.H;

/** Head at Q, m. A sampled `table` takes precedence over the polynomial. */
export function pumpCurveHeadM(curve: PumpCurve, Q: number): number {
  const hMin = curve.hMin ?? 0;
  const table = curve.table;
  if (!table?.length) {
    if (!curve.coeffs) throw new Error("Pump curve needs coeffs or a table");
    return pumpHeadM(curve.coeffs, Q, hMin);
  }
  const at = (q: number) => Math.max(hMin, interpTable(table, headOf, q).y);
  if (Q >= 0) return at(Q);
  return at(0) - 8e8 * Q * Q;
}

/** Pressure rise at Q, Pa. A sampled `table` takes precedence over the polynomial. */
export function fanCurveRisePa(curve: FanCurve, Q: number): number {
  const dpMin = curve.dpMin ?? 0;
  const table = curve.table;
  if (!table?.length) {
    if (!curve.coeffs) throw new Error("Fan curve needs coeffs or a table");
    return fanRisePa(curve.coeffs, Q, dpMin);
  }
  const at = (q: number) => Math.max(dpMin, interpTable(table, pressureOf, q).y);
  if (Q >= 0) return at(Q);
  return at(0) - 2e6 * Q * Q;
}

export interface EpsilonNtu {
  effectiveness: number;
  ntu: number;
  Cmin: number;
  Cmax: number;
  Cr: number;
}

export function epsilonNtu(args: {
  UA: number;
  C_hot: number;
  C_cold: number;
  arrangement: HexArrangement;
}): EpsilonNtu {
  const { UA, C_hot, C_cold, arrangement } = args;
  const Cmin = Math.min(C_hot, C_cold);
  const Cmax = Math.max(C_hot, C_cold);
  if (Cmin <= 1e-15) {
    return { effectiveness: 0, ntu: 0, Cmin, Cmax, Cr: 0 };
  }
  const Cr = Cmin / Cmax;
  const ntu = UA / Cmin;
  let e: number;
  if (arrangement === "parallel") {
    const den = 1 + Cr;
    e = den === 0 ? 1 : (1 - Math.exp(-ntu * den)) / den;
  } else if (arrangement === "crossflow-unmixed") {
    // Kays & London compact-HX approximation, both streams unmixed.
    e =
      1 -
      Math.exp(
        (Math.pow(ntu, 0.22) / Math.max(Cr, 1e-12)) *
          (Math.exp(-Cr * Math.pow(ntu, 0.78)) - 1),
      );
  } else {
    // counterflow
    if (Math.abs(1 - Cr) < 1e-9) {
      e = ntu / (ntu + 1);
    } else {
      const a = Math.exp(-ntu * (1 - Cr));
      e = (1 - a) / (1 - Cr * a);
    }
  }
  return {
    effectiveness: clamp01(e),
    ntu,
    Cmin,
    Cmax,
    Cr,
  };
}

export function hexHeat(args: {
  UA: number;
  C_hot: number;
  C_cold: number;
  T_hot_in: number;
  T_cold_in: number;
  arrangement: HexArrangement;
}): EpsilonNtu & { q: number; T_hot_out: number; T_cold_out: number } {
  const ntu = epsilonNtu(args);
  const qMax = ntu.Cmin * (args.T_hot_in - args.T_cold_in);
  const q = ntu.effectiveness * qMax;
  const T_hot_out = args.C_hot > 1e-15 ? args.T_hot_in - q / args.C_hot : args.T_hot_in;
  const T_cold_out = args.C_cold > 1e-15 ? args.T_cold_in + q / args.C_cold : args.T_cold_in;
  return { ...ntu, q, T_hot_out, T_cold_out };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

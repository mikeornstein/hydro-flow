import { G } from "./types";

/** One US gallon per minute, m³/s. */
export const GPM = 6.30901964e-5;

export function KtoC(T: number): number {
  return T - 273.15;
}

export function CtoK(T: number): number {
  return T + 273.15;
}

export function m3s_to_Lmin(Q: number): number {
  return Q * 60000;
}

export function Lmin_to_m3s(Q: number): number {
  return Q / 60000;
}

export function m3s_to_cfm(Q: number): number {
  return Q * 2118.88;
}

export function Pa_to_kPa(P: number): number {
  return P / 1000;
}

export function Pa_to_bar(P: number): number {
  return P / 1e5;
}

export function headM_from_dP(dP: number, rho: number): number {
  return dP / (rho * G);
}

export function formatFixed(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

export function formatTempC(T: number): string {
  return `${formatFixed(KtoC(T), 2)} °C`;
}

export function formatPressure(P: number): string {
  return `${formatFixed(Pa_to_kPa(P), 2)} kPa`;
}

export function formatFlowLiquid(Q: number): string {
  return `${formatFixed(m3s_to_Lmin(Q), 2)} L/min`;
}

export function formatFlowAir(Q: number): string {
  return `${formatFixed(m3s_to_cfm(Q), 1)} cfm`;
}

export function formatPower(W: number): string {
  if (Math.abs(W) >= 1000) return `${formatFixed(W / 1000, 2)} kW`;
  return `${formatFixed(W, 1)} W`;
}

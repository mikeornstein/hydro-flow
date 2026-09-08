import { G, type UnitPrefs } from "./types";

/** One US gallon per minute, m³/s. */
export const GPM = 6.30901964e-5;

/** One cubic foot per minute, m³/s. */
export const CFM = 1 / 2118.88;

export function KtoC(T: number): number {
  return T - 273.15;
}

export function CtoK(T: number): number {
  return T + 273.15;
}

export function KtoF(T: number): number {
  return KtoC(T) * (9 / 5) + 32;
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

export function m3s_to_gpm(Q: number): number {
  return Q / GPM;
}

export function Pa_to_kPa(P: number): number {
  return P / 1000;
}

export function Pa_to_bar(P: number): number {
  return P / 1e5;
}

export function Pa_to_psi(P: number): number {
  return P / 6894.757293168;
}

export function m_to_ft(L: number): number {
  return L / 0.3048;
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

/** Convert SI flow (m³/s) to UnitPrefs.flow. Air links default to cfm when prefs still say L/min. */
export function convertFlow(Q: number, units: UnitPrefs, air = false): { value: number; unit: string } {
  if (air && (units.flow === "L/min" || units.flow === "gpm" || units.flow === "m3/s")) {
    return { value: m3s_to_cfm(Q), unit: "cfm" };
  }
  switch (units.flow) {
    case "m3/s":
      return { value: Q, unit: "m3/s" };
    case "gpm":
      return { value: m3s_to_gpm(Q), unit: "gpm" };
    case "cfm":
      return { value: m3s_to_cfm(Q), unit: "cfm" };
    case "L/min":
    default:
      return { value: m3s_to_Lmin(Q), unit: "L/min" };
  }
}

export function convertPressure(P: number, units: UnitPrefs): { value: number; unit: string } {
  switch (units.pressure) {
    case "Pa":
      return { value: P, unit: "Pa" };
    case "bar":
      return { value: Pa_to_bar(P), unit: "bar" };
    case "psi":
      return { value: Pa_to_psi(P), unit: "psi" };
    case "kPa":
    default:
      return { value: Pa_to_kPa(P), unit: "kPa" };
  }
}

export function convertVelocity(V: number, units: UnitPrefs): { value: number; unit: string } {
  if (units.system === "IP" || units.length === "ft" || units.length === "in") {
    return { value: m_to_ft(V), unit: "ft/s" };
  }
  return { value: V, unit: "m/s" };
}

export function convertTemp(T: number, units: UnitPrefs): { value: number; unit: string } {
  switch (units.temperature) {
    case "K":
      return { value: T, unit: "K" };
    case "F":
      return { value: KtoF(T), unit: "F" };
    case "C":
    default:
      return { value: KtoC(T), unit: "C" };
  }
}

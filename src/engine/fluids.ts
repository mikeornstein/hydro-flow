import type { Fluid } from "./types";

/** Standard 20 °C water. */
export const WATER: Fluid = {
  id: "water",
  name: "Water",
  phase: "liquid",
  rho: 998.2,
  mu: 1.002e-3,
  cp: 4182,
  k: 0.598,
  beta: 2.07e-4,
  Tref: 293.15,
};

/** Liquid water near 30 °C — typical DLC loop mean. */
export const WATER_30C: Fluid = {
  id: "water-30C",
  name: "Water (30 °C)",
  phase: "liquid",
  rho: 995.65,
  mu: 7.977e-4,
  cp: 4178,
  k: 0.6155,
  beta: 3.03e-4,
  Tref: 303.15,
};

/** 25% ethylene glycol / water by volume, ~20 °C. */
export const EGW25: Fluid = {
  id: "egw25",
  name: "EG 25% / water",
  phase: "liquid",
  rho: 1035,
  mu: 1.8e-3,
  cp: 3790,
  k: 0.48,
  beta: 3.4e-4,
  Tref: 293.15,
};

/** Dry air at 25 °C, 1 atm. */
export const AIR_25C: Fluid = {
  id: "air-25C",
  name: "Dry air (25 °C)",
  phase: "gas",
  rho: 1.184,
  mu: 1.849e-5,
  cp: 1007,
  k: 0.0263,
  beta: 1 / 298.15,
  Tref: 298.15,
};

export const FLUIDS: Record<string, Fluid> = {
  [WATER.id]: WATER,
  [WATER_30C.id]: WATER_30C,
  [EGW25.id]: EGW25,
  [AIR_25C.id]: AIR_25C,
};

export function fluidById(id: string, extra: Record<string, Fluid> = {}): Fluid {
  const f = extra[id] ?? FLUIDS[id];
  if (!f) throw new Error(`Unknown fluid "${id}"`);
  return f;
}

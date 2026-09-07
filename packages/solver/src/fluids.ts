import type { FluidModel } from "./types.js";

/** A small built-in fluid library (constant properties at ~20 °C, SI). */
export const FLUIDS: Record<string, FluidModel> = {
  water: {
    id: "water",
    name: "Water (20 °C)",
    model: "constant",
    rho: 998,
    mu: 1.002e-3,
    cp: 4182,
    k: 0.598,
  },
  seawater: {
    id: "seawater",
    name: "Seawater (20 °C)",
    model: "constant",
    rho: 1025,
    mu: 1.07e-3,
    cp: 3993,
    k: 0.596,
  },
  glycol50: {
    id: "glycol50",
    name: "50% Ethylene Glycol (20 °C)",
    model: "constant",
    rho: 1075,
    mu: 4.0e-3,
    cp: 3300,
    k: 0.38,
  },
  air: {
    id: "air",
    name: "Air (20 °C, 1 atm)",
    model: "constant",
    rho: 1.204,
    mu: 1.825e-5,
    cp: 1006,
    k: 0.0257,
  },
};

export function getFluid(id: string): FluidModel | undefined {
  return FLUIDS[id];
}

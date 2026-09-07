import { describe, expect, it } from "vitest";
import {
  darcyWeisbach,
  frictionFactorBlasius,
  frictionFactorChurchill,
  hagenPoiseuille,
} from "../src/engine/friction";
import { WATER } from "../src/engine/fluids";

describe("friction factor", () => {
  it("matches Hagen–Poiseuille in laminar flow (Re=1000)", () => {
    const Re = 1000;
    const f = frictionFactorChurchill(Re, 0);
    expect(f).toBeCloseTo(64 / Re, 3);
  });

  it("matches Blasius on a smooth turbulent pipe (Re=1e5)", () => {
    const Re = 1e5;
    const f = frictionFactorChurchill(Re, 0);
    const blasius = frictionFactorBlasius(Re);
    expect(Math.abs(f - blasius) / blasius).toBeLessThan(0.05);
  });

  it("Darcy–Weisbach recovers Hagen–Poiseuille for laminar water", () => {
    const D = 0.05;
    const L = 10;
    const Re = 1000;
    const V = (Re * WATER.mu) / (WATER.rho * D);
    const Q = V * 0.25 * Math.PI * D * D;
    const dw = darcyWeisbach({
      Q,
      L,
      D,
      eps: 0,
      rho: WATER.rho,
      mu: WATER.mu,
      K: 0,
    });
    const hp = hagenPoiseuille(Q, L, D, WATER.mu);
    expect(dw.Re).toBeCloseTo(Re, 6);
    expect(Math.abs(dw.dp - hp) / Math.abs(hp)).toBeLessThan(0.01);
  });
});

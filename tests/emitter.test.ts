import { describe, expect, it } from "vitest";
import { emitterDropPa } from "../src/engine/constitutive";
import { solveSteady } from "../src/engine/solve";
import type { Project } from "../src/engine/types";
import emitterProject from "../examples/emitter.hydroflow.json";

const example = emitterProject as unknown as Project;
const law = example.links[0].component.emitter!;
const Q_150kPa = 6.804138174398e-7;

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

function withSupplyGauge(gaugePa: number, D = 0.001): Project {
  const p = structuredClone(example);
  p.nodes[0].pFixed = 101325 + gaugePa;
  p.links[0].component.geometry.D = D;
  return p;
}

describe("emitter Q = k ΔP^x (U8, Golden D)", () => {
  it("emitterDropPa inverts the 2.0 L/h at 100 kPa calibration and is odd in Q", () => {
    const Q = 2.0e-3 / 3600;
    expect(relErr(emitterDropPa(law, Q), 100e3)).toBeLessThan(1e-12);
    expect(emitterDropPa(law, -Q)).toBeCloseTo(-100e3, 6);
    expect(emitterDropPa(law, 0)).toBe(0);
  });

  it("solves the Golden D example to the closed form", () => {
    const r = solveSteady(example);
    expect(r.status).toBe("converged");
    expect(relErr(r.links.emitter.Q, Q_150kPa)).toBeLessThan(1e-6);
    expect(r.links.emitter.dP).toBeCloseTo(150e3, 0);
  });

  it("converges from an initial guess four orders of magnitude too high", () => {
    const r = solveSteady(withSupplyGauge(150e3, 0.1));
    expect(r.status).toBe("converged");
    expect(relErr(r.links.emitter.Q, Q_150kPa)).toBeLessThan(1e-6);
  });

  it("scales flow by sqrt(1.5) between 100 kPa and 150 kPa (E9)", () => {
    const q100 = solveSteady(withSupplyGauge(100e3)).links.emitter.Q;
    const q150 = solveSteady(withSupplyGauge(150e3)).links.emitter.Q;
    expect(relErr(q150 / q100, Math.sqrt(1.5))).toBeLessThan(1e-6);
    expect(relErr(q100, 2.0e-3 / 3600)).toBeLessThan(1e-6);
  });
});

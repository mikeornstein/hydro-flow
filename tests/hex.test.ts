import { describe, expect, it } from "vitest";
import { epsilonNtu, hexHeat } from "../src/engine/thermo";

describe("ε-NTU", () => {
  it("balanced counterflow: ε = NTU/(NTU+1)", () => {
    const r = epsilonNtu({
      UA: 500,
      C_hot: 500,
      C_cold: 500,
      arrangement: "counterflow",
    });
    expect(r.ntu).toBeCloseTo(1, 12);
    expect(r.effectiveness).toBeCloseTo(0.5, 12);
  });

  it("Cr=0 (evaporator limit): ε = 1 − exp(−NTU)", () => {
    const ntu = 1.5;
    const r = epsilonNtu({
      UA: ntu * 10,
      C_hot: 10,
      C_cold: 1e9,
      arrangement: "counterflow",
    });
    expect(r.effectiveness).toBeCloseTo(1 - Math.exp(-ntu), 8);
  });

  it("conserves energy between streams", () => {
    const C_hot = 800;
    const C_cold = 300;
    const T_hot_in = 320;
    const T_cold_in = 298;
    const hx = hexHeat({
      UA: 400,
      C_hot,
      C_cold,
      T_hot_in,
      T_cold_in,
      arrangement: "crossflow-unmixed",
    });
    expect(C_hot * (T_hot_in - hx.T_hot_out)).toBeCloseTo(hx.q, 8);
    expect(C_cold * (hx.T_cold_out - T_cold_in)).toBeCloseTo(hx.q, 8);
    expect(hx.q).toBeGreaterThan(0);
    expect(hx.T_hot_out).toBeLessThan(T_hot_in);
    expect(hx.T_cold_out).toBeGreaterThan(T_cold_in);
  });
});

import { describe, expect, it } from "vitest";
import { compileDiagram } from "../src/diagram/compile";
import { solveSteady } from "../src/engine/solve";
import { verifySolution } from "../src/engine/verify";
import {
  DLC_GPU_COUNT,
  DLC_GPU_POWER_W,
  DLC_HEX_UA,
  DLC_RTH,
  DLC_TOTAL_HEAT_W,
  dlcPumpedCoolingDiagram,
  dlcPumpHeadM,
} from "../src/engine/examples/dlcPumpedCooling";
import { hexHeat } from "../src/engine/thermo";
import { WATER_30C, AIR_25C } from "../src/engine/fluids";
import { G } from "../src/engine/types";
import { m3s_to_Lmin } from "../src/engine/units";

describe("DLC pumped cooling worked example", () => {
  const diagram = dlcPumpedCoolingDiagram();
  const project = compileDiagram(diagram);
  const result = solveSteady(project);
  const report = verifySolution(project, result);

  it("compiles a two-fluid network with HEX coupling", () => {
    expect(project.couplings).toHaveLength(1);
    expect(project.couplings[0].ua).toBe(DLC_HEX_UA);
    expect(project.links.some((l) => l.component.type === "pump")).toBe(true);
    expect(project.links.some((l) => l.component.type === "fan")).toBe(true);
    expect(
      project.links.filter((l) => l.component.type === "cold-plate"),
    ).toHaveLength(DLC_GPU_COUNT);
  });

  it("converges hydraulics and energy", () => {
    expect(result.status).toBe("converged");
    expect(result.warnings.filter((w) => w.startsWith("Energy mismatch"))).toHaveLength(0);
  });

  it("passes conservation verification", () => {
    const failed = report.checks.filter((c) => !c.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);
  });

  it("rejects exactly the GPU heat at the HEX", () => {
    const hx = result.couplings["hex.hx"];
    expect(hx.q).toBeCloseTo(DLC_TOTAL_HEAT_W, 0);
  });

  it("splits equally across identical GPU branches", () => {
    const qs = [0, 1, 2, 3].map((i) => result.links[`gpu${i}.core`].Q);
    const mean = qs.reduce((s, q) => s + q, 0) / qs.length;
    for (const q of qs) {
      expect(Math.abs(q - mean) / mean).toBeLessThan(1e-6);
    }
  });

  it("matches independent ε-NTU using solved flows and inlet temps", () => {
    const hx = result.couplings["hex.hx"];
    const hot = result.links["hex.liquid"];
    const cold = result.links["hex.air"];
    const indep = hexHeat({
      UA: DLC_HEX_UA,
      C_hot: Math.abs(hot.mdot) * WATER_30C.cp,
      C_cold: Math.abs(cold.mdot) * AIR_25C.cp,
      T_hot_in: hx.T_hot_in,
      T_cold_in: hx.T_cold_in,
      arrangement: "crossflow-unmixed",
    });
    expect(hx.q).toBeCloseTo(indep.q, 3);
    expect(hx.effectiveness).toBeCloseTo(indep.effectiveness, 6);
  });

  it("pump sits on its catalog curve", () => {
    const Q = result.links["pump.core"].Q;
    const H = dlcPumpHeadM(Q);
    const dP = result.nodes["pump.out"].P - result.nodes["pump.in"].P;
    const Hnet = dP / (WATER_30C.rho * G);
    // Net head ≈ catalog head minus the small internal K=1.5 loss.
    expect(Hnet).toBeGreaterThan(5);
    expect(Hnet).toBeLessThan(H + 0.2);
    expect(m3s_to_Lmin(Q)).toBeGreaterThan(5);
    expect(m3s_to_Lmin(Q)).toBeLessThan(30);
  });

  it("GPU case temperatures use Rth and mean coolant", () => {
    for (let i = 0; i < DLC_GPU_COUNT; i++) {
      const L = result.links[`gpu${i}.core`];
      const Tmean = 0.5 * (L.T_in! + L.T_out!);
      expect(L.T_surface).toBeCloseTo(Tmean + DLC_GPU_POWER_W * DLC_RTH, 5);
      expect(L.T_surface!).toBeGreaterThan(L.T_out!);
    }
  });

  it("air leaves hotter than it entered, coolant returns cooler than HEX inlet", () => {
    const hx = result.couplings["hex.hx"];
    expect(hx.T_cold_out).toBeGreaterThan(hx.T_cold_in);
    expect(hx.T_hot_out).toBeLessThan(hx.T_hot_in);
    expect(hx.T_cold_in).toBeCloseTo(298.15, 2);
  });

  it("liquid ΔT around the loop equals Q_heat / (ṁ cp)", () => {
    const mdot = Math.abs(result.links["pump.core"].mdot);
    const dT = DLC_TOTAL_HEAT_W / (mdot * WATER_30C.cp);
    const Tsup = result.nodes["supplyManifold"].T;
    const Tret = result.nodes["returnManifold"].T;
    expect(Tret - Tsup).toBeCloseTo(dT, 2);
  });
});

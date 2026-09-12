import { describe, expect, it } from "vitest";
import { compileDiagram } from "../src/diagram/compile";
import { IssAtcs, IssAtcsFigures } from "../src/engine/examples/issAtcs";
import { ModuleNetwork } from "../src/engine/moduleNetwork";
import { energyBalance, solveSteady } from "../src/engine/solve";
import { verifySolution } from "../src/engine/verify";
import { loadExamplePayload } from "../src/ui/examples/catalog";
import { equipmentReadout } from "../src/ui/flow/equipmentReadout";

describe("ISS Active Thermal Control System demo", () => {
  const project = IssAtcs.project();
  const result = solveSteady(project);
  const report = verifySolution(project, result);
  const bal = energyBalance(project, result.links, result.couplings);
  const F = IssAtcsFigures;

  it("keeps a compact modular deck", () => {
    expect(project.modules).toHaveLength(1);
    expect(project.instances?.map((i) => i.id).sort()).toEqual(["lt-packs", "mt-packs"]);
    expect(project.instances?.every((i) => i.module === "cold-plate-pack")).toBe(true);
    expect(project.links.filter((l) => l.id.includes("cross-"))).toEqual([]);
    expect(project.links.filter((l) => l.component.type === "radiator")).toHaveLength(2);
    expect(project.couplings).toHaveLength(2);
    expect(project.analysis.gravity).toBe(false);
    expect(project.nodes.every((n) => n.tFixed === undefined)).toBe(true);
  });

  it("expands four cold-plate packs from one module", () => {
    const flat = ModuleNetwork.expand(project);
    const laterals = flat.links.filter((l) => /packs#\d+:cross-/.test(l.id));
    expect(laterals).toHaveLength(2 * 2 * IssAtcs.PACK.nChannels);
    expect(flat.modules).toBeUndefined();
  });

  it("converges with radiators as the only ambient sink", () => {
    expect(result.status, result.warnings.join("; ")).toBe("converged");
    expect(result.warnings.filter((w) => w.startsWith("Energy mismatch"))).toEqual([]);
    expect(bal.sources).toBe(F.EATCS_LOOP_W * F.EATCS_LOOPS);
    expect(bal.hex).toBe(0);
    expect(Math.abs(bal.sinks - bal.sources) / bal.sources).toBeLessThan(0.002);
  });

  it("rejects about 35 kW on each ammonia wing", () => {
    const a = -result.links["a-rad"].q!;
    const b = -result.links["b-rad"].q!;
    expect(a / F.EATCS_LOOP_W).toBeGreaterThan(0.98);
    expect(a / F.EATCS_LOOP_W).toBeLessThan(1.02);
    expect(b / F.EATCS_LOOP_W).toBeGreaterThan(0.98);
    expect(b / F.EATCS_LOOP_W).toBeLessThan(1.02);
    expect(result.couplings["ifhx-lt"].q / F.EATCS_LOOP_W).toBeGreaterThan(0.98);
    expect(result.couplings["ifhx-mt"].q / F.EATCS_LOOP_W).toBeGreaterThan(0.98);
  });

  it("lands ammonia flow near the published Loop A / Loop B rates", () => {
    const a = IssAtcsFigures.kgSToLbH(Math.abs(result.links["a-pump"].mdot));
    const b = IssAtcsFigures.kgSToLbH(Math.abs(result.links["b-pump"].mdot));
    expect(a / F.LOOP_A_LB_H).toBeGreaterThan(0.85);
    expect(a / F.LOOP_A_LB_H).toBeLessThan(1.15);
    expect(b / F.LOOP_B_LB_H).toBeGreaterThan(0.85);
    expect(b / F.LOOP_B_LB_H).toBeLessThan(1.15);
  });

  it("sits water and ammonia supplies in the published bands", () => {
    const C = (id: string) => result.nodes[id].T - 273.15;
    expect(C("lt-tank")).toBeGreaterThanOrEqual(F.LTL_BAND_C[0]);
    expect(C("lt-tank")).toBeLessThanOrEqual(F.LTL_BAND_C[1]);
    expect(C("mt-tank")).toBeGreaterThanOrEqual(F.MTL_BAND_C[0]);
    expect(C("mt-tank")).toBeLessThanOrEqual(F.MTL_BAND_C[1]);
    const nh3Band = 2; // ±2 °F around 37 °F, NASA ATCS overview
    const nh3C = F.NH3_SUPPLY_K - 273.15;
    expect(Math.abs(C("a-tank") - nh3C)).toBeLessThan(nh3Band * (5 / 9) + 0.2);
    expect(Math.abs(C("b-tank") - nh3C)).toBeLessThan(nh3Band * (5 / 9) + 0.2);
  });

  it("pins pump inlets at the published 300 psia", () => {
    expect(result.nodes["a-tank"].P).toBeCloseTo(F.pumpInletPa(), 0);
    expect(result.nodes["b-tank"].P).toBeCloseTo(F.pumpInletPa(), 0);
  });

  it("does not use the 28.7 kW simulator figure as a load", () => {
    expect(bal.sources).not.toBe(F.SIMULATOR_W);
    expect(project.meta.description).toMatch(/28\.7 kW/);
    expect(project.meta.description).toMatch(/Simulator/);
  });

  it("passes verification including radiator identities", () => {
    const failed = report.checks.filter((c) => !c.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);
    expect(report.checks.map((c) => c.id)).toEqual(
      expect.arrayContaining(["energy-global", "radiator-q-a-rad", "radiator-q-b-rad"]),
    );
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
  });

  it("loads from the catalog as a pinned project", () => {
    const payload = loadExamplePayload(IssAtcs.ID);
    expect(payload.pinnedProject).toBeTruthy();
    expect(payload.pinnedProject).toEqual(project);
    expect(payload.entry.file).toBe(IssAtcs.FILE);
    expect(payload.diagram.nodes.filter((n) => n.kind === "radiator")).toHaveLength(2);
    expect(payload.diagram.nodes.filter((n) => n.kind === "pump")).toHaveLength(4);
    expect(payload.diagram.nodes.some((n) => n.id.startsWith("inst:lt-packs"))).toBe(true);
    expect(payload.diagram.nodes.some((n) => n.id.startsWith("inst:mt-packs"))).toBe(true);

    const aRad = payload.diagram.nodes.find((n) => n.sourceLinkId === "a-rad");
    expect(aRad).toBeTruthy();
    expect(equipmentReadout(aRad!, result)).toMatch(/kW → sink/);
  });

  it("canvas recompile is hydraulic-only; HEX couplings live on the pin", () => {
    const { diagram } = loadExamplePayload(IssAtcs.ID);
    const compiled = compileDiagram(diagram);
    expect(compiled.couplings).toEqual([]);
    const r = solveSteady(compiled);
    expect(r.status).toBe("converged");
    expect(r.warnings.some((w) => w.startsWith("Energy Jacobian"))).toBe(true);
  });
});

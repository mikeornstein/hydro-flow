import { describe, expect, it } from "vitest";
import { compileDiagram } from "../src/diagram/compile";
import { projectToDiagram } from "../src/diagram/projectToDiagram";
import {
  pumpedRadiatorLoopDiagram,
  RAD_LOAD_W,
  RAD_T_SINK,
  RAD_UA,
  radPumpHeadM,
} from "../src/engine/examples/pumpedRadiatorLoop";
import { WATER_30C } from "../src/engine/fluids";
import { Radiator } from "../src/engine/radiator";
import { solveSteady } from "../src/engine/solve";
import { G } from "../src/engine/types";
import { m3s_to_Lmin } from "../src/engine/units";
import { verifySolution } from "../src/engine/verify";
import { loadExamplePayload } from "../src/ui/examples/catalog";
import { equipmentReadout } from "../src/ui/flow/equipmentReadout";

describe("pumped radiator loop worked example", () => {
  const diagram = pumpedRadiatorLoopDiagram();
  const project = compileDiagram(diagram);
  const result = solveSteady(project);
  const report = verifySolution(project, result);
  const rad = result.links["rad.core"];
  const law = { ua: RAD_UA, tSink: RAD_T_SINK };

  it("compiles to one radiator link carrying the law and zero couplings", () => {
    const radiators = project.links.filter((l) => l.component.type === "radiator");
    expect(radiators).toHaveLength(1);
    expect(radiators[0].component.radiator).toEqual(law);
    expect(radiators[0].component.q).toBeUndefined();
    expect(project.couplings).toEqual([]);
    expect(project.nodes.every((n) => n.tFixed === undefined)).toBe(true);
  });

  it("converges with no energy mismatch warning", () => {
    expect(result.status).toBe("converged");
    expect(result.warnings).toEqual([]);
  });

  it("passes every verification check, radiator checks included", () => {
    const failed = report.checks.filter((c) => !c.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);
    expect(report.checks.map((c) => c.id)).toEqual(
      expect.arrayContaining(["energy-global", "radiator-q-rad.core", "radiator-dT-rad.core"]),
    );
  });

  it("rejects the cold-plate load at the panel (LinkResult.q negative)", () => {
    expect(rad.q!).toBeLessThan(0);
    expect(Math.abs(-rad.q! - RAD_LOAD_W) / RAD_LOAD_W).toBeLessThan(0.002);
  });

  it("floats the loop to T_in = tSink + load / U at the solved ṁ", () => {
    const C = Math.abs(rad.mdot) * WATER_30C.cp;
    const { U, effectiveness } = Radiator.conductance(law, C);
    expect(rad.T_in).toBeCloseTo(RAD_T_SINK + RAD_LOAD_W / U, 6);
    expect(rad.T_in! - RAD_T_SINK).toBeGreaterThan(8);
    expect(rad.T_in! - RAD_T_SINK).toBeLessThan(14);
    expect(effectiveness).toBeGreaterThan(0.3);
    expect(effectiveness).toBeLessThan(0.5);
  });

  it("loop ΔT equals load / (ṁ cp) at both the plate and the panel", () => {
    const mdot = Math.abs(result.links["pump.core"].mdot);
    const dT = RAD_LOAD_W / (mdot * WATER_30C.cp);
    const plate = result.links["load.core"];
    expect(plate.T_out! - plate.T_in!).toBeCloseTo(dT, 5);
    expect(rad.T_in! - rad.T_out!).toBeCloseTo(dT, 5);
    expect(result.nodes["rad.out"].T).toBeCloseTo(result.nodes["tank"].T, 9);
  });

  it("pump sits on its curve near 5 L/min", () => {
    const Q = result.links["pump.core"].Q;
    const Hnet = (result.nodes["pump.out"].P - result.nodes["pump.in"].P) / (WATER_30C.rho * G);
    expect(Hnet).toBeLessThan(radPumpHeadM(Q));
    expect(Hnet).toBeGreaterThan(radPumpHeadM(Q) - 0.1);
    expect(m3s_to_Lmin(Q)).toBeGreaterThan(4);
    expect(m3s_to_Lmin(Q)).toBeLessThan(7);
  });

  it("survives a canvas round trip: projectToDiagram → compile → solve keeps the law", () => {
    const roundTrip = compileDiagram(projectToDiagram(project));
    const link = roundTrip.links.find((l) => l.component.type === "radiator")!;
    expect(link.component.radiator).toEqual(law);
    const r2 = solveSteady(roundTrip);
    expect(r2.status).toBe("converged");
    expect(-r2.links[link.id].q!).toBeCloseTo(RAD_LOAD_W, 6);
  });

  it("shows rejected power and outlet temperature on the canvas node", () => {
    const node = diagram.nodes.find((n) => n.id === "rad")!;
    expect(equipmentReadout(node, null)).toBe("unsolved");
    expect(equipmentReadout(node, result)).toMatch(/^1\.50 kW → sink\s+·\s+2\d\.\d\d °C$/);
  });

  it("loads from the catalog as a hand-authored diagram", () => {
    const payload = loadExamplePayload("pumped-radiator-loop");
    expect(payload.pinnedProject).toBeNull();
    expect(payload.diagram.name).toBe(payload.entry.title);
    expect(payload.diagram.nodes.filter((n) => n.kind === "radiator")).toHaveLength(1);
  });
});

describe("compileDiagram radiator boundary", () => {
  it("throws when a radiator node has no params.radiator", () => {
    const diagram = pumpedRadiatorLoopDiagram();
    const rad = diagram.nodes.find((n) => n.id === "rad")!;
    delete rad.params.radiator;
    expect(() => compileDiagram(diagram)).toThrow(/Radiator rad needs params\.radiator/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectToDiagram } from "../src/diagram/projectToDiagram";
import { instancedColdPlates } from "../src/engine/examples/instancedColdPlates";
import { ModuleNetwork } from "../src/engine/moduleNetwork";
import { solveSteady } from "../src/engine/solve";

const DEMO_FILE = "examples/instanced-cold-plates.hydroflow.json";

function inletFlows(result: { links: Record<string, { Q: number }> }, count: number): number[] {
  return Array.from({ length: count }, (_, i) => result.links[`plates#${i}:in-F0`]?.Q ?? 0);
}

describe("parametric modules + instances", () => {
  it("keeps the compact deck free of pack internals", () => {
    const file = JSON.parse(readFileSync(DEMO_FILE, "utf8"));
    expect(file.modules).toHaveLength(1);
    expect(file.instances).toHaveLength(1);
    expect(file.instances[0].count).toBe(3);
    expect(file.links.filter((l: { id: string }) => l.id.includes("cross-"))).toEqual([]);
    const project = instancedColdPlates(3);
    expect(project.modules).toHaveLength(1);
    expect(project.instances).toEqual([
      expect.objectContaining({ id: "plates", module: "channel-pack", count: 3 }),
    ]);
    expect(project.links.filter((l) => l.id.includes("cross-"))).toEqual([]);
    expect(project.nodes.map((n) => n.id).sort()).toEqual(["inlet", "outlet", "return", "supply"]);
  });

  it("expands three 7-channel packs to 21 laterals", () => {
    const flat = ModuleNetwork.expand(instancedColdPlates(3));
    const laterals = flat.links.filter((l) => /^plates#\d+:cross-\d+$/.test(l.id));
    expect(laterals).toHaveLength(21);
    expect(flat.modules).toBeUndefined();
    expect(flat.instances).toBeUndefined();
  });

  it("solveSteady on the compact project matches expanded lateral sum", () => {
    const compact = instancedColdPlates(3);
    const result = solveSteady(compact);
    expect(result.status).toBe("converged");
    const inlets = inletFlows(result, 3);
    const inletSum = inlets.reduce((a, b) => a + b, 0);
    const lateralSum = Object.entries(result.links)
      .filter(([id]) => /^plates#\d+:cross-\d+$/.test(id))
      .reduce((s, [, l]) => s + l.Q, 0);
    expect(Math.abs(inletSum - lateralSum) / inletSum).toBeLessThan(1e-6);
    expect(inlets.every((q) => q > 0)).toBe(true);
  });

  it("three packs carry 3× the single-pack flow within 1%", () => {
    const one = solveSteady(instancedColdPlates(1));
    const three = solveSteady(instancedColdPlates(3));
    expect(one.status).toBe("converged");
    expect(three.status).toBe("converged");
    const q1 = inletFlows(one, 1).reduce((a, b) => a + b, 0);
    const q3 = inletFlows(three, 3).reduce((a, b) => a + b, 0);
    expect(Math.abs(q3 / q1 - 3)).toBeLessThanOrEqual(0.01);
  });

  it("round-trips through JSON and the committed example file", () => {
    const project = instancedColdPlates();
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    const file = JSON.parse(readFileSync(DEMO_FILE, "utf8"));
    expect(file).toEqual(project);
  });

  it("draws three pack glyphs, not exploded laterals", () => {
    const diagram = projectToDiagram(instancedColdPlates(3));
    const plates = diagram.nodes.filter((n) => n.kind === "coldPlate");
    expect(plates).toHaveLength(3);
    expect(diagram.nodes.some((n) => n.id === "F0" || n.id === "plates#0:F0")).toBe(false);
    expect(plates.map((n) => n.sourceLinkId)).toEqual([
      "plates#0:in-F0",
      "plates#1:in-F0",
      "plates#2:in-F0",
    ]);
  });

  it("expand is idempotent", () => {
    const once = ModuleNetwork.expand(instancedColdPlates(3));
    const twice = ModuleNetwork.expand(once);
    expect(twice.nodes).toEqual(once.nodes);
    expect(twice.links).toEqual(once.links);
  });
});

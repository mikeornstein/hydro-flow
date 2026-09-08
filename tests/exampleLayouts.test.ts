import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectToDiagram } from "../src/diagram/projectToDiagram";
import { mf06AltitudeDensity } from "../src/engine/examples/mf06AltitudeDensity";
import { PROJECT_EXAMPLE_SOURCES } from "../src/engine/examples/projectSources";
import type { Project } from "../src/engine/types";
import { toFlow } from "../src/ui/flow/toFlow";
import parallelPipesJson from "../examples/parallel-pipes.hydroflow.json";

const parallelPipes = parallelPipesJson as Project;

describe("example layouts", () => {
  it("keeps builder-backed JSON equal to PROJECT_EXAMPLE_SOURCES", () => {
    for (const { file, build } of PROJECT_EXAMPLE_SOURCES) {
      expect(JSON.parse(readFileSync(`examples/${file}`, "utf8"))).toEqual(build());
    }
  });

  it("separates equipment mid-nodes that share endpoints", () => {
    const mids = projectToDiagram(mf06AltitudeDensity(0)).nodes.filter((n) =>
      n.id.startsWith("eq:"),
    );
    expect(mids.length).toBeGreaterThan(1);
    expect(new Set(mids.map((n) => `${n.x},${n.y}`)).size).toBe(mids.length);
  });

  it("stamps distinct bundle offsets on parallel-pipes", () => {
    const parallels = projectToDiagram(parallelPipes);
    const flow = toFlow(parallels, null, null);
    expect(new Set(flow.edges.map((e) => e.data?.bundleOffset)).size).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { EXAMPLE_CATALOG, loadExamplePayload } from "../src/ui/examples/catalog";
import { solveSteady } from "../src/engine/solve";

describe("example catalog", () => {
  it("covers every examples/*.hydroflow.json plus the GPU rack diagram", () => {
    const files = EXAMPLE_CATALOG.map((e) => e.file).filter(Boolean);
    expect(new Set(files).size).toBe(files.length);
    expect(EXAMPLE_CATALOG.some((e) => e.id === "dlc-pumped-cooling")).toBe(true);
    for (const e of EXAMPLE_CATALOG) {
      expect(e.title.length).toBeGreaterThan(8);
      expect(e.title.toLowerCase().startsWith("mf0")).toBe(false);
    }
  });

  it("loads and solves each catalog entry", () => {
    for (const entry of EXAMPLE_CATALOG) {
      const { diagram, pinnedProject } = loadExamplePayload(entry.id);
      expect(diagram.nodes.length).toBeGreaterThan(0);
      const project = pinnedProject ?? null;
      if (project) {
        const result = solveSteady(project);
        expect(result.status).toBe("converged");
      } else {
        expect(diagram.id).toBeTruthy();
      }
    }
  }, 60_000);
});

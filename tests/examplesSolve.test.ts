import { describe, expect, it } from "vitest";
import { compileDiagram } from "../src/diagram/compile";
import { EXAMPLE_CATALOG, loadExamplePayload } from "../src/ui/examples/catalog";
import { equipmentReadout } from "../src/ui/flow/equipmentReadout";
import { solveSteady } from "../src/engine/solve";

describe("catalog examples solve end-to-end", () => {
  it("solves every catalog entry via the UI load path (pin or compile)", () => {
    const failures: string[] = [];
    for (const entry of EXAMPLE_CATALOG) {
      try {
        const { diagram, pinnedProject } = loadExamplePayload(entry.id);
        const project = pinnedProject ?? compileDiagram(diagram);
        const result = solveSteady(project);
        if (result.status !== "converged") {
          failures.push(`${entry.id}: status ${result.status}`);
        }
      } catch (e) {
        failures.push(`${entry.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);

  it("recompiles every file-backed example from its canvas diagram without Missing fluid", () => {
    const failures: string[] = [];
    for (const entry of EXAMPLE_CATALOG) {
      if (!entry.file) continue;
      try {
        const { diagram } = loadExamplePayload(entry.id);
        if (!diagram.fluids || Object.keys(diagram.fluids).length === 0) {
          failures.push(`${entry.id}: diagram.fluids missing`);
          continue;
        }
        const project = compileDiagram(diagram);
        const result = solveSteady(project);
        if (result.status !== "converged") {
          failures.push(`${entry.id}: status ${result.status}`);
        }
      } catch (e) {
        failures.push(`${entry.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);

  it("shows real mf04 cold-plate readouts after a pinned solve (not unsolved/em-dash)", () => {
    const { diagram, pinnedProject } = loadExamplePayload("mf04-orifice-balanced");
    expect(pinnedProject).toBeTruthy();
    const result = solveSteady(pinnedProject!);
    expect(result.status).toBe("converged");

    const plates = diagram.nodes.filter((n) => n.kind === "coldPlate");
    expect(plates.length).toBe(3);
    for (const plate of plates) {
      const text = equipmentReadout(plate, result);
      expect(text, plate.id).not.toBe("unsolved");
      expect(text, plate.id).not.toBe("—");
      expect(text, plate.id).toMatch(/°C/);
    }

    const outlet = diagram.nodes.find((n) => n.id === "outlet");
    expect(outlet).toBeTruthy();
    expect(equipmentReadout(outlet!, result)).toMatch(/°C/);
  });
});

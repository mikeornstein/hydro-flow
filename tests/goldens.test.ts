import { describe, expect, it } from "vitest";
import { compileDiagram } from "../src/diagram/compile";
import { dlcPumpedCoolingDiagram } from "../src/engine/examples/dlcPumpedCooling";
import { solveSteady } from "../src/engine/solve";
import { polyval } from "../src/engine/thermo";
import { G, type Project } from "../src/engine/types";
import goldensJson from "./fixtures/goldens.json";
import seriesPipes from "../examples/series-pipes.hydroflow.json";
import pumpLoop from "../examples/pump-loop.hydroflow.json";
import parallelPipes from "../examples/parallel-pipes.hydroflow.json";
import emitterProject from "../examples/emitter.hydroflow.json";
import dlcProject from "../examples/dlc-pumped-cooling.hydroflow.json";

const projects: Record<string, Project> = {
  "examples/series-pipes.hydroflow.json": seriesPipes as Project,
  "examples/pump-loop.hydroflow.json": pumpLoop as Project,
  "examples/parallel-pipes.hydroflow.json": parallelPipes as Project,
  "examples/emitter.hydroflow.json": emitterProject as Project,
  "examples/dlc-pumped-cooling.hydroflow.json": dlcProject as Project,
};

interface GoldenFile {
  tolerance: { flowRelative: number; pressureRelative: number };
  cases: {
    id: string;
    file: string | null;
    expected?: {
      links?: Record<string, { Q?: number; V?: number; Re?: number; f?: number; H?: number }>;
      nodes?: Record<string, { P?: number }>;
      totals?: { Q?: number };
    };
  }[];
}

const goldens = goldensJson as unknown as GoldenFile;
const flowTol = goldens.tolerance.flowRelative;
const pTol = goldens.tolerance.pressureRelative;

it("compiled DLC diagram matches examples/dlc-pumped-cooling.hydroflow.json", () => {
  const compiled = compileDiagram(dlcPumpedCoolingDiagram(), {
    createdAt: "2026-09-07T00:00:00Z",
  });
  expect(compiled).toEqual(dlcProject);
});

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-15);
}

describe("P0 goldens vs this solver", () => {
  for (const c of goldens.cases) {
    if (!c.file) {
      it(`${c.id} is deferred (no project file)`, () => {
        expect(c.file).toBeNull();
      });
      continue;
    }
    it(`${c.id} matches ${c.file} within ${flowTol * 100}%`, () => {
      const project = projects[c.file!];
      expect(project, `fixture ${c.file}`).toBeTruthy();
      const result = solveSteady(project);
      expect(result.status).toBe("converged");
      for (const [id, exp] of Object.entries(c.expected?.links ?? {})) {
        const link = result.links[id];
        expect(link, `missing link ${id}`).toBeTruthy();
        if (typeof exp.Q === "number") {
          expect(relErr(link.Q, exp.Q), `${id} Q`).toBeLessThanOrEqual(flowTol);
        }
        if (typeof exp.V === "number") {
          expect(relErr(link.V, exp.V), `${id} V`).toBeLessThanOrEqual(flowTol);
        }
        if (typeof exp.Re === "number") {
          expect(relErr(link.Re, exp.Re), `${id} Re`).toBeLessThanOrEqual(flowTol);
        }
        if (typeof exp.f === "number" && link.f !== undefined) {
          expect(relErr(link.f, exp.f), `${id} f`).toBeLessThanOrEqual(flowTol);
        }
        if (typeof exp.H === "number") {
          const def = project.links.find((l) => l.id === id);
          expect(def).toBeTruthy();
          const pump = def!.component.pump;
          const fluid = project.fluids[def!.fluid];
          const H = pump
            ? polyval(pump.coeffs, link.Q)
            : (result.nodes[def!.to].P - result.nodes[def!.from].P) / (fluid.rho * G);
          expect(relErr(H, exp.H), `${id} H`).toBeLessThanOrEqual(flowTol);
        }
      }
      for (const [id, exp] of Object.entries(c.expected?.nodes ?? {})) {
        const node = result.nodes[id];
        expect(node, `missing node ${id}`).toBeTruthy();
        if (typeof exp.P === "number") {
          expect(relErr(node.P, exp.P), `${id} P`).toBeLessThanOrEqual(pTol);
        }
      }
      if (typeof c.expected?.totals?.Q === "number") {
        const sum = Object.keys(c.expected.links ?? {}).reduce((s, id) => s + result.links[id].Q, 0);
        expect(relErr(sum, c.expected.totals.Q), "total Q").toBeLessThanOrEqual(flowTol);
      }
    });
  }
});

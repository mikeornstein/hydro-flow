import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  branchFlowsGpm,
  mf03ColdPlateHeader,
  type Mf03HeaderKind,
} from "../src/engine/examples/mf03ColdPlateHeader";
import { solveSteady } from "../src/engine/solve";
import fig3 from "./fixtures/paper/mf03-fig3-digitized.json";

const kinds: Mf03HeaderKind[] = ["7/16", "7/8"];
const OUT = "tests/fixtures/paper/out";

function maxMinRatio(qs: number[]): number {
  return Math.max(...qs) / Math.min(...qs);
}

describe("MF03 cold-plate header (paper replay)", () => {
  it("example JSON matches the builder", () => {
    for (const kind of kinds) {
      const slug = kind.replace("/", "_");
      const file = JSON.parse(
        readFileSync(`examples/mf03-cold-plate-header-${slug}.hydroflow.json`, "utf8"),
      );
      expect(file).toEqual(mf03ColdPlateHeader(kind));
    }
  });

  it("larger header reduces max/min branch-flow ratio", () => {
    const results: Record<string, number[]> = {};
    for (const kind of kinds) {
      const project = mf03ColdPlateHeader(kind);
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      results[kind] = branchFlowsGpm(project, solved.links);
      const sum = results[kind].reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 5) / 5).toBeLessThan(1e-6);
    }
    expect(maxMinRatio(results["7/8"])).toBeLessThan(maxMinRatio(results["7/16"]));
    expect(maxMinRatio(results["7/8"])).toBeLessThan(1.05);
  });

  it("reports side-by-side vs digitized Fig 3 and stays within paper-replay band", () => {
    mkdirSync(OUT, { recursive: true });
    const rows: string[] = [
      "header\tpassage\tpaper_gpm\thydroflow_gpm\trel_err\tabs_err_gpm",
    ];
    let maxRel = 0;
    for (const kind of kinds) {
      const project = mf03ColdPlateHeader(kind);
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      const ours = branchFlowsGpm(project, solved.links);
      const paper = fig3.cases[kind].branch_Q_gpm;
      for (let i = 0; i < 7; i++) {
        const abs = Math.abs(ours[i] - paper[i]);
        const rel = abs / paper[i];
        maxRel = Math.max(maxRel, rel);
        rows.push(
          `${kind}\t${i + 1}\t${paper[i].toFixed(3)}\t${ours[i].toFixed(3)}\t${(rel * 100).toFixed(1)}%\t${abs.toFixed(3)}`,
        );
      }
    }
    writeFileSync(`${OUT}/mf03-fig3-comparison.tsv`, rows.join("\n") + "\n");
    expect(maxRel).toBeLessThanOrEqual(0.15);
  });
});

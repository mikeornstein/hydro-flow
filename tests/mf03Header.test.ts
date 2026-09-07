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
const variants = [
  { label: "junctions", tees: false, suffix: "", band: 0.15 },
  { label: "idelchik-tees", tees: true, suffix: "-tees", band: 0.25 },
];
const OUT = "tests/fixtures/paper/out";

function maxMinRatio(qs: number[]): number {
  return Math.max(...qs) / Math.min(...qs);
}

function solvedGpm(kind: Mf03HeaderKind, tees: boolean): number[] {
  const project = mf03ColdPlateHeader(kind, { tees });
  const solved = solveSteady(project);
  expect(solved.status).toBe("converged");
  const gpm = branchFlowsGpm(project, solved.links);
  const sum = gpm.reduce((a, b) => a + b, 0);
  expect(Math.abs(sum - 5) / 5).toBeLessThan(1e-6);
  return gpm;
}

describe("MF03 cold-plate header (paper replay)", () => {
  it("example JSON matches the builder", () => {
    for (const kind of kinds) {
      for (const v of variants) {
        const slug = kind.replace("/", "_");
        const file = JSON.parse(
          readFileSync(`examples/mf03-cold-plate-header-${slug}${v.suffix}.hydroflow.json`, "utf8"),
        );
        expect(file).toEqual(mf03ColdPlateHeader(kind, { tees: v.tees }));
      }
    }
  });

  it("larger header reduces max/min branch-flow ratio", () => {
    for (const v of variants) {
      const small = solvedGpm("7/16", v.tees);
      const large = solvedGpm("7/8", v.tees);
      expect(maxMinRatio(large)).toBeLessThan(maxMinRatio(small));
      expect(maxMinRatio(large)).toBeLessThan(1.05);
    }
  });

  it("sharp tees flatten the 7/16 header against the paper's steeper bars", () => {
    const junctions = solvedGpm("7/16", false);
    const tees = solvedGpm("7/16", true);
    const paper = maxMinRatio(fig3.cases["7/16"].branch_Q_gpm);
    expect(maxMinRatio(tees)).toBeLessThan(maxMinRatio(junctions));
    expect(maxMinRatio(junctions)).toBeLessThan(paper);
  });

  it("reports side-by-side vs digitized Fig 3 and stays within each variant's band", () => {
    mkdirSync(OUT, { recursive: true });
    const rows: string[] = [
      "variant\theader\tpassage\tpaper_gpm\thydroflow_gpm\trel_err\tabs_err_gpm",
    ];
    for (const v of variants) {
      let maxRel = 0;
      for (const kind of kinds) {
        const ours = solvedGpm(kind, v.tees);
        const paper = fig3.cases[kind].branch_Q_gpm;
        for (let i = 0; i < 7; i++) {
          const abs = Math.abs(ours[i] - paper[i]);
          const rel = abs / paper[i];
          maxRel = Math.max(maxRel, rel);
          rows.push(
            `${v.label}\t${kind}\t${i + 1}\t${paper[i].toFixed(3)}\t${ours[i].toFixed(3)}\t${(rel * 100).toFixed(1)}%\t${abs.toFixed(3)}`,
          );
        }
      }
      expect(maxRel, v.label).toBeLessThanOrEqual(v.band);
    }
    writeFileSync(`${OUT}/mf03-fig3-comparison.tsv`, rows.join("\n") + "\n");
  });
});

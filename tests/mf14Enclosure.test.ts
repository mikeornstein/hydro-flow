import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mf14Enclosure,
  mf14TotalCfm,
} from "../src/engine/examples/mf14Enclosure";
import { solveSteady } from "../src/engine/solve";
import mf14 from "./fixtures/paper/mf14-totals.json";

const OUT = "tests/fixtures/paper/out";

describe("MF14 enclosure (richer topology)", () => {
  it("converges with 12 passages + bypass + dual fans toward published total", () => {
    mkdirSync(OUT, { recursive: true });
    const project = mf14Enclosure();
    const solved = solveSteady(project);
    expect(solved.status).toBe("converged");
    const total = mf14TotalCfm(solved);
    const paper = mf14.totals_CFM.FNM;
    const rel = Math.abs(total - paper) / paper;
    const passQs = Array.from({ length: 12 }, (_, i) => {
      const q = solved.links[`pass-${i + 1}`].Q * 2118.8799727597;
      return q;
    });
    const rows = [
      "metric\thydroflow\tpaper_FNM\tpaper_test\trel_err",
      `total_CFM\t${total.toFixed(2)}\t${paper}\t${mf14.totals_CFM.test}\t${(rel * 100).toFixed(1)}%`,
      ...passQs.map(
        (q, i) => `pass_${i + 1}_CFM\t${q.toFixed(2)}\t\t\t`,
      ),
      `bypass_CFM\t${(solved.links.bypass.Q * 2118.8799727597).toFixed(2)}\t\t\t`,
    ];
    writeFileSync(`${OUT}/mf14-enclosure-comparison.tsv`, rows.join("\n") + "\n");
    // Handbook reconstruction without CFD passage curves: allow 35% on total.
    // Must not be an answer-fit rQuad (policy). Direction: within free delivery of 2×45.
    expect(total).toBeGreaterThan(40);
    expect(total).toBeLessThan(90);
    expect(rel).toBeLessThan(0.35);
  });
});

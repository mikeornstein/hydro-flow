import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mf09HeatSinkBypass, MF09_Q_TOTAL } from "../src/engine/examples/mf09HeatSinkBypass";
import { solveSteady } from "../src/engine/solve";
import fig4 from "./fixtures/paper/mf09-fig4-digitized.json";

const OUT = "tests/fixtures/paper/out";

function sinkFraction(links: Record<string, { Q: number }>): number {
  const qSink = links.sink?.Q ?? 0;
  const qBy = links.bypass?.Q ?? 0;
  const total = qSink + qBy;
  return total === 0 ? 0 : qSink / total;
}

describe("MF09 heat-sink bypass (paper replay)", () => {
  it("sink fraction falls monotonically as clearance rises", () => {
    const clears = [0, 0.1, 0.2, 0.4, 0.6, 0.9];
    const fractions: number[] = [];
    for (const c of clears) {
      const project = mf09HeatSinkBypass(c);
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      const frac = sinkFraction(solved.links);
      const total =
        (solved.links.sink?.Q ?? 0) + (solved.links.bypass?.Q ?? 0);
      expect(Math.abs(total - MF09_Q_TOTAL) / MF09_Q_TOTAL).toBeLessThan(1e-5);
      fractions.push(frac);
    }
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeLessThan(fractions[i - 1]);
    }
  });

  it("reports side-by-side vs digitized Fig 4", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = ["clearFraction\tpaper_sinkFraction\thydroflow_sinkFraction\tabs_err"];
    let maxAbs = 0;
    for (const pt of fig4.points) {
      const clear = pt.clearFraction >= 0.999 ? 0.999 : pt.clearFraction;
      const project = mf09HeatSinkBypass(clear);
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      const frac = sinkFraction(solved.links);
      const abs = Math.abs(frac - pt.sinkFraction);
      maxAbs = Math.max(maxAbs, abs);
      rows.push(`${pt.clearFraction}\t${pt.sinkFraction}\t${frac.toFixed(3)}\t${abs.toFixed(3)}`);
    }
    writeFileSync(`${OUT}/mf09-fig4-comparison.tsv`, rows.join("\n") + "\n");
    // Handbook slot model vs digitized Fig 4: mid-curve still ~0.25 abs.
    // Monotonicity is the hard gate; numeric band documents remaining model gap.
    expect(maxAbs).toBeLessThanOrEqual(0.30);
  });
});

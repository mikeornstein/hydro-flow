import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  branchShares,
  mf03OrificeBalance,
} from "../src/engine/examples/mf03OrificeBalance";
import { solveSteady } from "../src/engine/solve";

const OUT = "tests/fixtures/paper/out";
const weights = [0.3, 0.4, 0.5, 3.0, 4.0];
const target = weights.map((w) => w / weights.reduce((a, b) => a + b, 0));

describe("MF03 orifice balance (flow-only paper replay)", () => {
  it("tuned orifices pull flow toward high-load branches vs identical", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = ["mode\tbranch\tshare\ttarget_share\tabs_err"];
    const shares: Record<string, number[]> = {};
    for (const mode of ["identical", "tuned"] as const) {
      const project = mf03OrificeBalance(mode);
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      shares[mode] = branchShares(solved.links);
      for (let i = 0; i < 5; i++) {
        rows.push(
          `${mode}\t${i + 1}\t${shares[mode][i].toFixed(3)}\t${target[i].toFixed(3)}\t${Math.abs(shares[mode][i] - target[i]).toFixed(3)}`,
        );
      }
    }
    writeFileSync(`${OUT}/mf03-orifice-comparison.tsv`, rows.join("\n") + "\n");
    // High-load branches 4 and 5 should gain share when orifices are tuned.
    expect(shares.tuned[3] + shares.tuned[4]).toBeGreaterThan(
      shares.identical[3] + shares.identical[4],
    );
    const maeTuned =
      shares.tuned.reduce((s, v, i) => s + Math.abs(v - target[i]), 0) / 5;
    const maeIdent =
      shares.identical.reduce((s, v, i) => s + Math.abs(v - target[i]), 0) / 5;
    expect(maeTuned).toBeLessThan(maeIdent);
  });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  branchShares,
  MF03_LOADS_KW,
  MF03_T_LIMIT_C,
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

describe("MF03 orifice balance + energy (fixed rTh, no Lytron)", () => {
  it("tuned orifices bring max plate surface below 60 °C while identical exceeds it", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = [
      "mode\tbranch\tload_kW\tQ_share\tT_surface_C\tlimit_C",
    ];
    const maxT: Record<string, number> = {};
    for (const mode of ["identical", "tuned"] as const) {
      const project = mf03OrificeBalance(mode, { energy: true });
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      const shares = branchShares(solved.links);
      let peak = -Infinity;
      for (let i = 0; i < 5; i++) {
        const Tc = solved.links[`plate-${i + 1}`].T_surface! - 273.15;
        peak = Math.max(peak, Tc);
        rows.push(
          `${mode}\t${i + 1}\t${MF03_LOADS_KW[i]}\t${shares[i].toFixed(3)}\t${Tc.toFixed(1)}\t${MF03_T_LIMIT_C}`,
        );
      }
      maxT[mode] = peak;
    }
    writeFileSync(`${OUT}/mf03-orifice-energy.tsv`, rows.join("\n") + "\n");
    expect(maxT.identical).toBeGreaterThan(MF03_T_LIMIT_C);
    expect(maxT.tuned).toBeLessThanOrEqual(MF03_T_LIMIT_C);
  });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mf08BypassBalance } from "../src/engine/examples/mf08BypassBalance";
import { solveSteady } from "../src/engine/solve";
import mf08 from "./fixtures/paper/mf08-table1.json";

const OUT = "tests/fixtures/paper/out";
const CFM = 2118.8799727597;

describe("MF08 bypass balance (qualitative paper replay)", () => {
  it("36% open raises processor path flow vs 100% open at fixed total", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = ["case\tbypassOpen\tproc_CFM\tbypass_CFM\tpaper_proc_avg"];
    const results: Record<string, number> = {};
    for (const [label, open, total, paperProc] of [
      ["A", 1.0, mf08.cases.A.total, mf08.cases.A.processor_avg],
      ["B", 0.36, mf08.cases.B.total, mf08.cases.B.processor_avg],
    ] as const) {
      const project = mf08BypassBalance(open, total);
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      const proc = solved.links.processors.Q * CFM;
      const by = solved.links["cpu-bypass"].Q * CFM;
      results[label] = proc;
      rows.push(`${label}\t${open}\t${proc.toFixed(2)}\t${by.toFixed(2)}\t${paperProc}`);
    }
    writeFileSync(`${OUT}/mf08-bypass-comparison.tsv`, rows.join("\n") + "\n");
    expect(results.B).toBeGreaterThan(results.A);
    // Directional match to Table 1; absolute CFM will differ without full impedance map.
    expect(results.B / results.A).toBeGreaterThan(1.2);
  });
});

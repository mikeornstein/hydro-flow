import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mf08BypassBalance,
  mf08ServerFan,
} from "../src/engine/examples/mf08BypassBalance";
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
    expect(results.B / results.A).toBeGreaterThan(1.2);
  });

  it("synthetic fan + richer impedance keeps Table 1 direction and improves absolute CFM", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = [
      "case\tproc_avg_CFM\tpci16_avg_CFM\tpci710_avg_CFM\ttotal_CFM\tpaper_proc\tpaper_total\tproc_rel_err\ttotal_rel_err",
    ];
    const totals: Record<string, number> = {};
    const procs: Record<string, number> = {};
    for (const caseId of ["A", "B", "C"] as const) {
      const solved = solveSteady(mf08ServerFan(caseId));
      expect(solved.status).toBe("converged");
      const procTotal = solved.links.processors.Q * CFM;
      const procAvg = procTotal / 4;
      const pci16 = (solved.links["pci-1-6"].Q * CFM) / 6;
      const pci710 = (solved.links["pci-7-10"].Q * CFM) / 4;
      const total =
        (solved.links.processors.Q + solved.links["cpu-bypass"].Q) * CFM;
      totals[caseId] = total;
      procs[caseId] = procAvg;
      const paper = mf08.cases[caseId];
      const procRel = Math.abs(procAvg - paper.processor_avg) / paper.processor_avg;
      const totRel = Math.abs(total - paper.total) / paper.total;
      rows.push(
        `${caseId}\t${procAvg.toFixed(2)}\t${pci16.toFixed(2)}\t${pci710.toFixed(2)}\t${total.toFixed(2)}\t${paper.processor_avg}\t${paper.total}\t${(procRel * 100).toFixed(1)}%\t${(totRel * 100).toFixed(1)}%`,
      );
    }
    writeFileSync(`${OUT}/mf08-fan-impedance.tsv`, rows.join("\n") + "\n");
    expect(procs.B).toBeGreaterThan(procs.A);
    expect(procs.C).toBeGreaterThan(procs.B);
    // Absolute: Case B total within 25% of Table 1 (synthetic fan, not catalog).
    expect(Math.abs(totals.B - mf08.cases.B.total) / mf08.cases.B.total).toBeLessThan(
      0.25,
    );
  });
});

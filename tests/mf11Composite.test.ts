import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mf11CompositeFromCurve,
  mf11ExpandedBlock,
  mf11Hierarchy,
  mf11LcmAtPublishedPoint,
  MF11_LCM,
  sampleDeltaPCurve,
} from "../src/engine/examples/mf11Composite";
import { solveSteady } from "../src/engine/solve";
import table1 from "./fixtures/paper/mf11-table1.json";

const OUT = "tests/fixtures/paper/out";
const GPM = 6.30901964e-5;
const PSI = 6894.757;

describe("MF11 composite curve reuse", () => {
  it("composite matches expanded network Q within 1% at the sample pressure", () => {
    mkdirSync(OUT, { recursive: true });
    const expanded = mf11ExpandedBlock();
    const curve = sampleDeltaPCurve(expanded, [120000, 135000, 150000, 165000, 180000]);
    const composite = mf11CompositeFromCurve(curve);
    const rExp = solveSteady(expanded);
    const rComp = solveSteady(composite);
    expect(rExp.status).toBe("converged");
    expect(rComp.status).toBe("converged");
    const qExp = Object.values(rExp.links).reduce((s, l) => s + l.Q, 0);
    const qComp = rComp.links.composite.Q;
    const rel = Math.abs(qComp - qExp) / qExp;
    writeFileSync(
      `${OUT}/mf11-composite-comparison.tsv`,
      [
        "metric\texpanded\tcomposite\trel_err",
        `Q_m3s\t${qExp}\t${qComp}\t${(rel * 100).toFixed(3)}%`,
        ...curve.map((c, i) => `curve_${i}_Q\t${c.Q}\t${c.dP}\t`),
      ].join("\n") + "\n",
    );
    expect(rel).toBeLessThanOrEqual(0.01);
  });
});

describe("MF11 Table 1 LCM golden + hierarchy", () => {
  it("single LCM hits published 0.12 gpm @ 3.50 psig within tol", () => {
    const project = mf11LcmAtPublishedPoint();
    const solved = solveSteady(project);
    expect(solved.status).toBe("converged");
    const Qgpm = solved.links.lcm.Q / GPM;
    const dPpsig = solved.links.lcm.dP / PSI;
    expect(Math.abs(Qgpm - MF11_LCM.Q_gpm)).toBeLessThanOrEqual(table1.rows.lcm.Q_tol);
    expect(Math.abs(dPpsig - MF11_LCM.dP_psig)).toBeLessThanOrEqual(
      table1.rows.lcm.dP_tol,
    );
  });

  it("writes hierarchy side-by-side TSV (LCM / row / system)", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = [
      "level\tn_parallel\tpaper_Q_gpm\thydroflow_Q_gpm\tpaper_dP_psig\tdrive_dP_psig\tQ_rel_err\tnote",
    ];
    for (const level of ["lcm", "row", "system"] as const) {
      const { project, nParallel, paperQ_gpm, paperDp_psig } = mf11Hierarchy(level);
      const solved = solveSteady(project);
      expect(solved.status).toBe("converged");
      const Qgpm = solved.links.lcm.Q / GPM;
      const driveDp = MF11_LCM.dP_psig;
      const rel = Math.abs(Qgpm - paperQ_gpm) / paperQ_gpm;
      const note =
        level === "lcm"
          ? "pinned_quadratic_through_Table1_point"
          : "parallel_LCMs_at_LCM_dP;_paper_row/system_dP_includes_manifold";
      rows.push(
        `${level}\t${nParallel}\t${paperQ_gpm}\t${Qgpm.toFixed(4)}\t${paperDp_psig}\t${driveDp}\t${(rel * 100).toFixed(2)}%\t${note}`,
      );
      if (level === "lcm") expect(rel).toBeLessThanOrEqual(0.01);
      // Integer parallel counts (28, 113) vs Table 1 ratios (28.333…, 113.333…).
      if (level !== "lcm") {
        expect(Math.abs(Qgpm - nParallel * MF11_LCM.Q_gpm)).toBeLessThan(1e-6);
        expect(rel).toBeLessThan(0.03);
      }
    }
    writeFileSync(`${OUT}/mf11-table1-hierarchy.tsv`, rows.join("\n") + "\n");
  });
});

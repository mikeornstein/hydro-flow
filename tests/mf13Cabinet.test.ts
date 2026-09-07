import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mf13CardCabinet,
  mf13PassageCfm,
} from "../src/engine/examples/mf13CardCabinet";
import { solveSteady } from "../src/engine/solve";
import figs from "./fixtures/paper/mf13-figs-digitized.json";

const OUT = "tests/fixtures/paper/out";
const CFM_UNC = figs.figures.fig3_design_I.uncertainty_CFM;

function maxMin(qs: number[]): number {
  return Math.max(...qs) / Math.min(...qs);
}

function solvePassages(
  design: "I" | "II",
  tees: boolean,
  correlation: "idelchik" | "gardel" = "idelchik",
): number[] {
  const project = mf13CardCabinet({ design, tees, correlation });
  const solved = solveSteady(project);
  expect(solved.status, `Design ${design} tees=${tees} ${correlation}`).toBe("converged");
  return mf13PassageCfm(solved);
}

describe("MF13 card cabinet (paper replay)", () => {
  it("friction-only is near-flat / slight near bias (opposite of Fig 3 spike)", () => {
    const q = solvePassages("I", false);
    expect(q[9] / q[0]).toBeLessThan(1.05);
    expect(q[9]).toBeLessThan(figs.figures.fig3_design_I.passage_Q_CFM[9] * 0.4);
  });

  it("Idelchik tees give mild far-passage bias (right direction, wrong magnitude)", () => {
    const friction = solvePassages("I", false);
    const tees = solvePassages("I", true);
    const paperFar =
      figs.figures.fig3_design_I.passage_Q_CFM[9] /
      figs.figures.fig3_design_I.passage_Q_CFM[0];
    expect(tees[9] / tees[0]).toBeGreaterThan(1);
    expect(tees[9] / tees[0]).toBeGreaterThan(friction[9] / friction[0]);
    // Fig 3 far/near ≈ 10.6; sharp tees only reach ~1.6 here.
    expect(tees[9] / tees[0]).toBeLessThan(paperFar * 0.3);
  });

  it("Design II + tees does not flatten like Fig 4 (taper steepens our far bias)", () => {
    const d1 = solvePassages("I", true);
    const d2 = solvePassages("II", true);
    expect(d2[9] / d2[0]).toBeGreaterThan(d1[9] / d1[0]);
    const paperII =
      figs.figures.fig4_design_II.passage_Q_CFM[9] /
      figs.figures.fig4_design_II.passage_Q_CFM[0];
    // Paper Design II far/near ≈ 2.5 with flat mid-passages; ours is steeper.
    expect(d2[9] / d2[0]).toBeGreaterThan(paperII);
  });

  it("writes side-by-side Fig 3/4 comparison TSV + discrepancy record", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = [
      "design\tvariant\tpassage\tpaper_CFM\thydroflow_CFM\tabs_err_CFM\trel_err",
    ];
    const discrepancy = {
      paper: "MF13",
      status: "documented_discrepancy",
      reason:
        "Idelchik and Gardel sharp 90° tees both produce mild Design I far-passage bias in the same direction as Fig 3 (far/near ≈ 10.6), but the magnitude remains far too small. Friction-only stays near-flat. Design II 18° taper plus tees steepens far bias further instead of flattening mid-passages as in Fig 4. MacroFlow's unpublished tee/inertia correlation remains the gap. No momentum hack / ζ scaling shipped.",
      digitized_fig3_sum_CFM: figs.figures.fig3_design_I.sum_CFM,
      digitized_fig4_sum_CFM: figs.figures.fig4_design_II.sum_CFM,
      digitization_uncertainty_CFM: CFM_UNC,
      paper_designI_far_over_near: +(
        figs.figures.fig3_design_I.passage_Q_CFM[9] /
        figs.figures.fig3_design_I.passage_Q_CFM[0]
      ).toFixed(3),
      hydroflow: {} as Record<string, unknown>,
      next: "Rounded-entry wye if hardware supports it, or other published tee families with verifiable handbook identities; do not invent momentum recovery.",
    };

    for (const design of ["I", "II"] as const) {
      const paper =
        design === "I"
          ? figs.figures.fig3_design_I.passage_Q_CFM
          : figs.figures.fig4_design_II.passage_Q_CFM;
      for (const [label, tees, correlation] of [
        ["friction", false, "idelchik"],
        ["idelchik-tees", true, "idelchik"],
        ["gardel-tees", true, "gardel"],
      ] as const) {
        const ours = solvePassages(design, tees, correlation);
        discrepancy.hydroflow[`design${design}_${label}`] = {
          passage_Q_CFM: ours.map((v) => +v.toFixed(2)),
          sum_CFM: +ours.reduce((a, b) => a + b, 0).toFixed(2),
          max_min: +maxMin(ours).toFixed(3),
          far_over_near: +(ours[9] / ours[0]).toFixed(3),
        };
        for (let i = 0; i < 10; i++) {
          const abs = Math.abs(ours[i] - paper[i]);
          const rel = abs / Math.max(paper[i], 1e-9);
          rows.push(
            `${design}\t${label}\t${i + 1}\t${paper[i].toFixed(2)}\t${ours[i].toFixed(2)}\t${abs.toFixed(2)}\t${(rel * 100).toFixed(1)}%`,
          );
        }
      }
    }
    writeFileSync(`${OUT}/mf13-fig3-4-comparison.tsv`, rows.join("\n") + "\n");
    writeFileSync(
      "tests/fixtures/paper/mf13-discrepancy.json",
      JSON.stringify(discrepancy, null, 2) + "\n",
    );
    const teesI = discrepancy.hydroflow["designI_idelchik-tees"] as {
      far_over_near: number;
    };
    const gardelI = discrepancy.hydroflow["designI_gardel-tees"] as {
      far_over_near: number;
    };
    expect(teesI.far_over_near).toBeGreaterThan(1);
    expect(teesI.far_over_near).toBeLessThan(
      discrepancy.paper_designI_far_over_near * 0.3,
    );
    expect(gardelI.far_over_near).toBeGreaterThan(1);
    expect(gardelI.far_over_near).toBeLessThan(
      discrepancy.paper_designI_far_over_near * 0.3,
    );
  });
});

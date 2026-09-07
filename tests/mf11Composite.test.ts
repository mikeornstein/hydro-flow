import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mf11CompositeFromCurve,
  mf11ExpandedBlock,
  sampleDeltaPCurve,
} from "../src/engine/examples/mf11Composite";
import { solveSteady } from "../src/engine/solve";

const OUT = "tests/fixtures/paper/out";

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
        ...curve.map(
          (c, i) => `curve_${i}_Q\t${c.Q}\t${c.dP}\t`,
        ),
      ].join("\n") + "\n",
    );
    expect(rel).toBeLessThanOrEqual(0.01);
  });
});

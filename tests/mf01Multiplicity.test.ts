import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mf01ExpandedCardStack,
  mf01MultiplicityChassis,
} from "../src/engine/examples/mf01Multiplicity";
import { solveSteady } from "../src/engine/solve";
import table1 from "./fixtures/paper/mf01-table1.json";

const OUT = "tests/fixtures/paper/out";
const CFM = 2118.8799727597;

describe("MF01 multiplicity pattern", () => {
  it("records OCR Table 1 B candidates and rejects them as SI rQuad", () => {
    expect(table1.ocr_B_Pa_per_m3s2.DASD).toBe(1e-4);
    expect(table1.ocr_B_Pa_per_m3s2.Memory).toBe(5e-6);
    // At 30 CFM, OCR DASD B yields ΔP ≪ 0.01 Pa vs Main fan shutoff ~37 Pa.
    const Q = 30 / CFM;
    const dP = table1.ocr_B_Pa_per_m3s2.DASD * Q * Q;
    expect(dP).toBeLessThan(0.01);
    expect(table1.usable_as_si_rquad).toBe(false);
  });

  it("parallelCount=4 matches four expanded card links within 1%", () => {
    mkdirSync(OUT, { recursive: true });
    const multi = solveSteady(mf01MultiplicityChassis());
    const expanded = solveSteady(mf01ExpandedCardStack());
    expect(multi.status).toBe("converged");
    expect(expanded.status).toBe("converged");
    const qMulti = multi.links["card-stack"].Q;
    const qExp = [1, 2, 3, 4]
      .map((i) => expanded.links[`card-${i}`].Q)
      .reduce((a, b) => a + b, 0);
    const rel = Math.abs(qMulti - qExp) / qExp;
    const rows = [
      "metric\tmultiplicity_CFM\texpanded_CFM\trel_err",
      `card_stack\t${(qMulti * CFM).toFixed(2)}\t${(qExp * CFM).toFixed(2)}\t${(rel * 100).toFixed(3)}%`,
      `main_fan\t${(multi.links["main-fan"].Q * CFM).toFixed(2)}\t${(expanded.links["main-fan"].Q * CFM).toFixed(2)}\t`,
      `psu_fan\t${(multi.links["psu-fan"].Q * CFM).toFixed(2)}\t${(expanded.links["psu-fan"].Q * CFM).toFixed(2)}\t`,
    ];
    writeFileSync(`${OUT}/mf01-multiplicity-comparison.tsv`, rows.join("\n") + "\n");
    expect(rel).toBeLessThanOrEqual(0.01);
  });
});

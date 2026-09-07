import { describe, expect, it } from "vitest";
import mf08 from "./fixtures/paper/mf08-table1.json";
import mf14 from "./fixtures/paper/mf14-totals.json";

describe("MF08 / MF14 published quantitative anchors", () => {
  it("MF08 Table 1 inequalities hold in the publication", () => {
    expect(mf08.cases.B.processor_avg).toBeGreaterThan(mf08.cases.A.processor_avg);
    expect(mf08.cases.C.processor_avg).toBeGreaterThan(mf08.cases.B.processor_avg);
    expect(mf08.cases.C.total).toBeGreaterThan(mf08.cases.A.total);
    expect(mf08.cases.B.processor_avg).toBeGreaterThanOrEqual(mf08.goals.processor_CFM);
  });

  it("MF14 FNM total is within 2% of the published hardware total", () => {
    const rel = Math.abs(mf14.totals_CFM.FNM - mf14.totals_CFM.test) / mf14.totals_CFM.test;
    expect(rel).toBeLessThan(0.02);
  });

  it("documents reconstruction status rather than inventing catalog curves", () => {
    expect(mf08.reconstruction).toMatch(/partial_synthetic_fan|blocked/);
    expect(mf14.reconstruction).toMatch(/partial/);
  });
});

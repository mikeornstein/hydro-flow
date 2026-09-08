import { describe, expect, it } from "vitest";
import { solveSteady } from "../src/engine/solve";
import { DEFAULT_UNITS, type Project, type UnitPrefs } from "../src/engine/types";
import { m3s_to_Lmin, Pa_to_kPa, Pa_to_psi } from "../src/engine/units";
import { buildResultsTable, resultsTableCsv } from "../src/ui/results/table";
import seriesPipes from "../examples/series-pipes.hydroflow.json";
import dlcProject from "../examples/dlc-pumped-cooling.hydroflow.json";

const series = seriesPipes as Project;
const dlc = dlcProject as Project;

describe("results table / CSV (ORN-25 W7 E6)", () => {
  it("builds one row per link with Q, dP, V, Re for series-pipes", () => {
    const result = solveSteady(series);
    expect(result.status).toBe("converged");
    const siQ = Object.fromEntries(
      Object.entries(result.links).map(([id, r]) => [id, r.Q]),
    );
    const table = buildResultsTable(series, result, DEFAULT_UNITS);
    expect(table.rows).toHaveLength(series.links.length);
    expect(table.includeEnergy).toBe(false);
    for (const row of table.rows) {
      expect(row.QUnit).toBe("L/min");
      expect(row.dPUnit).toBe("kPa");
      expect(row.VUnit).toBe("m/s");
      expect(Number.isFinite(row.Q)).toBe(true);
      expect(Number.isFinite(row.dP)).toBe(true);
      expect(Number.isFinite(row.V)).toBe(true);
      expect(Number.isFinite(row.Re)).toBe(true);
      expect(row.T_in).toBeUndefined();
      expect(row.T_out).toBeUndefined();
      const link = result.links[row.id];
      expect(row.Q).toBeCloseTo(m3s_to_Lmin(link.Q), 6);
      expect(row.dP).toBeCloseTo(Pa_to_kPa(link.dP), 6);
      expect(row.V).toBeCloseTo(link.V, 10);
      expect(row.Re).toBeCloseTo(link.Re, 10);
    }
    // Stored SI unchanged after building display rows.
    for (const [id, Q] of Object.entries(siQ)) {
      expect(result.links[id].Q).toBe(Q);
    }
  });

  it("CSV headers carry units and include one data row per link", () => {
    const result = solveSteady(series);
    const table = buildResultsTable(series, result, DEFAULT_UNITS);
    const csv = resultsTableCsv(table);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("id,name,Q (L/min),dP (kPa),V (m/s),Re");
    expect(lines).toHaveLength(1 + series.links.length);
    expect(csv).not.toMatch(/T_in/);
  });

  it("psi prefs change display dP without mutating SI LinkResult.dP", () => {
    const result = solveSteady(series);
    const before = { ...result.links["pipe-1"] };
    const psiUnits: UnitPrefs = { ...DEFAULT_UNITS, system: "IP", pressure: "psi", flow: "gpm" };
    const table = buildResultsTable(series, result, psiUnits);
    const row = table.rows.find((r) => r.id === "pipe-1")!;
    expect(row.dPUnit).toBe("psi");
    expect(row.QUnit).toBe("gpm");
    expect(row.dP).toBeCloseTo(Pa_to_psi(before.dP), 6);
    expect(result.links["pipe-1"].dP).toBe(before.dP);
    expect(result.links["pipe-1"].Q).toBe(before.Q);
    const csv = resultsTableCsv(table);
    expect(csv.split("\n")[0]).toContain("dP (psi)");
    expect(csv.split("\n")[0]).toContain("Q (gpm)");
  });

  it("includes T columns when analysis.energy is on", () => {
    const result = solveSteady(dlc);
    expect(result.status).toBe("converged");
    expect(dlc.analysis.energy).toBe(true);
    const table = buildResultsTable(dlc, result, DEFAULT_UNITS);
    expect(table.includeEnergy).toBe(true);
    expect(table.rows.length).toBe(dlc.links.length);
    for (const row of table.rows) {
      expect(row.T_in).toBeTypeOf("number");
      expect(row.T_out).toBeTypeOf("number");
      expect(row.TUnit).toBe("C");
    }
    const csv = resultsTableCsv(table);
    expect(csv.split("\n")[0]).toContain("T_in (C)");
    expect(csv.split("\n")[0]).toContain("T_out (C)");
  });
});

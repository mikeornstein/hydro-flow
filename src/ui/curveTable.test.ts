import { describe, expect, it } from "vitest";
import {
  formatCurveTable,
  headRows,
  parseCurveTable,
  pressureRows,
  toHeadTable,
  toPressureTable,
} from "./curveTable";

describe("parseCurveTable", () => {
  it("accepts comma, tab, semicolon, and space separated rows", () => {
    expect(parseCurveTable("0,150\n0.05,83.3\n0.075,0").rows).toEqual([
      [0, 150],
      [0.05, 83.3],
      [0.075, 0],
    ]);
    expect(parseCurveTable("0\t150\n0.05\t83.3").rows).toEqual([
      [0, 150],
      [0.05, 83.3],
    ]);
    expect(parseCurveTable("0; 150\r\n0.05 ;83.3\r\n").rows).toEqual([
      [0, 150],
      [0.05, 83.3],
    ]);
    expect(parseCurveTable("  0   150\n0.05 83.3").rows).toEqual([
      [0, 150],
      [0.05, 83.3],
    ]);
  });

  it("skips a header row, blank lines, and # comments; sorts by Q", () => {
    const text = "Q (m3/s), dP (Pa)\n\n# from CFD sweep\n0.02,240\n0,0\n1e-2,50\n";
    expect(parseCurveTable(text)).toEqual({
      rows: [
        [0, 0],
        [0.01, 50],
        [0.02, 240],
      ],
      error: null,
    });
  });

  it("reports the offending line for bad input and never returns partial rows", () => {
    expect(parseCurveTable("0,0\nabc,5")).toEqual({
      rows: [],
      error: 'Line 2: expected two numbers, got "abc,5"',
    });
    expect(parseCurveTable("0,0\n0.01,5,7").error).toBe("Line 2: expected two columns, got 3");
    expect(parseCurveTable("-0.01,5\n0.01,5").error).toBe("Line 1: Q must be ≥ 0");
    expect(parseCurveTable("0.01,5\n0.01,6").error).toBe("Q = 0.01 appears twice");
    expect(parseCurveTable("0.01,5").error).toBe("Need at least two rows of Q and value");
    expect(parseCurveTable("").error).toBe("Need at least two rows of Q and value");
  });

  it("round-trips through formatCurveTable and the engine point shapes", () => {
    const rows = parseCurveTable("0,16\n0.0002,12\n0.0004,0").rows;
    expect(parseCurveTable(formatCurveTable(rows)).rows).toEqual(rows);
    expect(formatCurveTable(rows)).toBe("0,16\n0.0002,12\n0.0004,0");
    const head = toHeadTable(rows);
    expect(head).toEqual([
      { Q: 0, H: 16 },
      { Q: 0.0002, H: 12 },
      { Q: 0.0004, H: 0 },
    ]);
    expect(headRows(head)).toEqual(rows);
    const dp = toPressureTable(rows);
    expect(dp[1]).toEqual({ Q: 0.0002, dP: 12 });
    expect(pressureRows(dp)).toEqual(rows);
    expect(headRows(undefined)).toEqual([]);
  });
});

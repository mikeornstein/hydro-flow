import type { HeadPoint, PressurePoint } from "../engine/types";

/** One parsed "Q, value" row in SI (m³/s and Pa or m). */
export type CurveRow = readonly [Q: number, y: number];

export interface CurveParse {
  rows: CurveRow[];
  /** Set when the text cannot be used; `rows` is then empty. */
  error: string | null;
}

const SEPARATORS = /[,\t;]+|\s+/;

function asNumber(token: string): number | null {
  if (token === "") return null;
  const v = Number(token);
  return Number.isFinite(v) ? v : null;
}

/**
 * Parse pasted or uploaded text with one "Q, value" sample per line. Comma,
 * tab, semicolon, or whitespace separate the two columns. Blank lines and
 * `#` comments are skipped; a leading non-numeric line is treated as a
 * header. Rows come back sorted by Q. Fewer than two rows, a negative Q, or a
 * repeated Q is an error.
 */
export function parseCurveTable(text: string): CurveParse {
  const rows: [number, number][] = [];
  let sawData = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (raw === "" || raw.startsWith("#")) continue;
    const tokens = raw.split(SEPARATORS).filter((t) => t !== "");
    const nums = tokens.map(asNumber);
    if (nums.some((n) => n === null)) {
      if (!sawData) continue;
      return { rows: [], error: `Line ${i + 1}: expected two numbers, got "${raw}"` };
    }
    sawData = true;
    if (nums.length !== 2) {
      return { rows: [], error: `Line ${i + 1}: expected two columns, got ${nums.length}` };
    }
    const [Q, y] = nums as [number, number];
    if (Q < 0) return { rows: [], error: `Line ${i + 1}: Q must be ≥ 0` };
    rows.push([Q, y]);
  }
  if (rows.length < 2) {
    return { rows: [], error: "Need at least two rows of Q and value" };
  }
  rows.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === rows[i - 1][0]) {
      return { rows: [], error: `Q = ${rows[i][0]} appears twice` };
    }
  }
  return { rows, error: null };
}

/** Inverse of `parseCurveTable`: one "Q,value" line per row, shortest round-trip digits. */
export function formatCurveTable(rows: readonly CurveRow[]): string {
  return rows.map(([Q, y]) => `${Q},${y}`).join("\n");
}

export function toHeadTable(rows: readonly CurveRow[]): HeadPoint[] {
  return rows.map(([Q, H]) => ({ Q, H }));
}

export function toPressureTable(rows: readonly CurveRow[]): PressurePoint[] {
  return rows.map(([Q, dP]) => ({ Q, dP }));
}

export function headRows(table: readonly HeadPoint[] | undefined): CurveRow[] {
  return (table ?? []).map((p) => [p.Q, p.H] as const);
}

export function pressureRows(table: readonly PressurePoint[] | undefined): CurveRow[] {
  return (table ?? []).map((p) => [p.Q, p.dP] as const);
}

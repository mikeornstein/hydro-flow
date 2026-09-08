import type { PressurePoint } from "./types";

/** Any table row keyed by volumetric flow, m³/s. */
export interface QPoint {
  Q: number;
}

/** Where a query flow sits relative to the tabulated Q range. */
export type TableRange = "in" | "below" | "above";

export interface TableSample {
  y: number;
  range: TableRange;
}

/**
 * Validated view of a user table ordered by Q. Returns the input when it is
 * already ascending, otherwise a sorted copy. Duplicate Q is rejected because
 * it makes the interpolant ambiguous.
 */
export function sortedByQ<T extends QPoint>(table: readonly T[]): readonly T[] {
  if (table.length < 2) {
    throw new Error("Curve table needs at least two points");
  }
  let ascending = true;
  for (let i = 0; i < table.length; i++) {
    if (!Number.isFinite(table[i].Q)) {
      throw new Error("Curve table has a non-finite Q");
    }
    if (i > 0 && table[i].Q <= table[i - 1].Q) ascending = false;
  }
  const sorted = ascending ? table : [...table].sort((a, b) => a.Q - b.Q);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].Q === sorted[i - 1].Q) {
      throw new Error(`Curve table repeats Q = ${sorted[i].Q}`);
    }
  }
  return sorted;
}

function finite(v: number, what: string): number {
  if (!Number.isFinite(v)) throw new Error(`Curve table has a non-finite ${what}`);
  return v;
}

/**
 * Piecewise-linear y(Q) on a table already ordered by Q. Outside the
 * tabulated range the end sample is held and `range` says which side.
 */
export function interpSorted<T extends QPoint>(
  sorted: readonly T[],
  y: (p: T) => number,
  Q: number,
): TableSample {
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (Q <= first.Q) {
    return { y: finite(y(first), "value"), range: Q < first.Q ? "below" : "in" };
  }
  if (Q >= last.Q) {
    return { y: finite(y(last), "value"), range: Q > last.Q ? "above" : "in" };
  }
  let lo = 0;
  let hi = sorted.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].Q <= Q) lo = mid;
    else hi = mid;
  }
  const a = sorted[lo];
  const b = sorted[hi];
  const ya = finite(y(a), "value");
  const yb = finite(y(b), "value");
  const t = (Q - a.Q) / (b.Q - a.Q);
  return { y: ya + t * (yb - ya), range: "in" };
}

/** `interpSorted` on an arbitrary (possibly unsorted) user table. */
export function interpTable<T extends QPoint>(
  table: readonly T[],
  y: (p: T) => number,
  Q: number,
): TableSample {
  return interpSorted(sortedByQ(table), y, Q);
}

/** Range classification only, for post-solve warnings. */
export function tableRange(table: readonly QPoint[], Q: number): TableRange {
  const sorted = sortedByQ(table);
  if (Q < sorted[0].Q) return "below";
  if (Q > sorted[sorted.length - 1].Q) return "above";
  return "in";
}

export const pressureOf = (p: PressurePoint): number => p.dP;

/**
 * Imported Δp(Q) loss, Pa, evaluated at the per-path flow. Odd in Q like the
 * other losses. Above the last sample the drop is held; below the first
 * sample it falls linearly to the origin so a table that starts above Q = 0
 * cannot put a step in the loss at zero flow.
 */
export function dpTableLossPa(table: readonly PressurePoint[], Q: number): number {
  const sorted = sortedByQ(table);
  const q = Math.abs(Q);
  const sample = interpSorted(sorted, pressureOf, q);
  const sign = Q < 0 ? -1 : 1;
  if (sample.range === "below") {
    const first = sorted[0];
    return sign * ((finite(first.dP, "value") * q) / first.Q);
  }
  return sign * sample.y;
}

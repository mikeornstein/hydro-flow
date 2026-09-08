import type { Diagram } from "../diagram/types";
import {
  convertFlow,
  convertPressure,
} from "../engine/units";
import {
  DEFAULT_UNITS,
  type Project,
  type SolveResult,
  type UnitPrefs,
} from "../engine/types";
import type { VerificationReport } from "../engine/verify";

export interface CompareSlot {
  label: string;
  diagram: Diagram;
  pinnedProject: Project | null;
  project: Project | null;
  result: SolveResult | null;
  report: VerificationReport | null;
  exampleId: string;
}

export interface CompareLinkRow {
  id: string;
  name: string;
  Qa: number;
  Qb: number;
  dQ: number;
  QUnit: string;
  dPa: number;
  dPb: number;
  dDP: number;
  dPUnit: string;
}

/** Deep-clone a live session into a compare slot. */
export function cloneSlot(fields: {
  label: string;
  diagram: Diagram;
  pinnedProject: Project | null;
  project: Project | null;
  result: SolveResult | null;
  report: VerificationReport | null;
  exampleId: string;
}): CompareSlot {
  return {
    label: fields.label,
    diagram: structuredClone(fields.diagram),
    pinnedProject: fields.pinnedProject ? structuredClone(fields.pinnedProject) : null,
    project: fields.project ? structuredClone(fields.project) : null,
    result: fields.result ? structuredClone(fields.result) : null,
    report: fields.report ? structuredClone(fields.report) : null,
    exampleId: fields.exampleId,
  };
}

/** Prefer project.links order from B (live), fall back to A. */
export function diffLinkResults(
  a: SolveResult,
  b: SolveResult,
  projectA: Project | null,
  projectB: Project | null,
  units: UnitPrefs = DEFAULT_UNITS,
): CompareLinkRow[] {
  const ids = new Set<string>([
    ...Object.keys(a.links),
    ...Object.keys(b.links),
  ]);
  const order =
    projectB?.links.map((l) => l.id).filter((id) => ids.has(id)) ??
    projectA?.links.map((l) => l.id).filter((id) => ids.has(id)) ??
    [...ids];
  for (const id of ids) {
    if (!order.includes(id)) order.push(id);
  }

  const nameOf = (id: string): string =>
    projectB?.links.find((l) => l.id === id)?.name ??
    projectA?.links.find((l) => l.id === id)?.name ??
    id;

  const airOf = (id: string): boolean => {
    const fluid =
      projectB?.links.find((l) => l.id === id)?.fluid ??
      projectA?.links.find((l) => l.id === id)?.fluid ??
      "";
    return fluid.includes("air");
  };

  const rows: CompareLinkRow[] = [];
  for (const id of order) {
    const la = a.links[id];
    const lb = b.links[id];
    if (!la || !lb) continue;
    const air = airOf(id);
    const Qa = convertFlow(la.Q, units, air);
    const Qb = convertFlow(lb.Q, units, air);
    const dPa = convertPressure(la.dP, units);
    const dPb = convertPressure(lb.dP, units);
    rows.push({
      id,
      name: nameOf(id),
      Qa: Qa.value,
      Qb: Qb.value,
      dQ: Qb.value - Qa.value,
      QUnit: Qb.unit,
      dPa: dPa.value,
      dPb: dPb.value,
      dDP: dPb.value - dPa.value,
      dPUnit: dPb.unit,
    });
  }
  return rows;
}

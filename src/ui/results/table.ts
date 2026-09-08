import {
  convertFlow,
  convertPressure,
  convertTemp,
  convertVelocity,
} from "../../engine/units";
import {
  DEFAULT_UNITS,
  type Project,
  type SolveResult,
  type UnitPrefs,
} from "../../engine/types";

export interface ResultsTableRow {
  id: string;
  name: string;
  Q: number;
  QUnit: string;
  dP: number;
  dPUnit: string;
  V: number;
  VUnit: string;
  Re: number;
  T_in?: number;
  T_out?: number;
  TUnit?: string;
  loss?: number;
  rise?: number;
  q?: number;
}

export interface ResultsTable {
  rows: ResultsTableRow[];
  includeEnergy: boolean;
  units: UnitPrefs;
}

export function buildResultsTable(
  project: Project,
  result: SolveResult,
  units: UnitPrefs = DEFAULT_UNITS,
): ResultsTable {
  const includeEnergy = project.analysis.energy;
  const rows: ResultsTableRow[] = [];
  for (const link of project.links) {
    const r = result.links[link.id];
    if (!r) continue;
    const air = link.fluid.includes("air");
    const Q = convertFlow(r.Q, units, air);
    const dP = convertPressure(r.dP, units);
    const V = convertVelocity(r.V, units);
    const row: ResultsTableRow = {
      id: link.id,
      name: link.name ?? link.id,
      Q: Q.value,
      QUnit: Q.unit,
      dP: dP.value,
      dPUnit: dP.unit,
      V: V.value,
      VUnit: V.unit,
      Re: r.Re,
      loss: convertPressure(r.loss, units).value,
      rise: convertPressure(r.rise, units).value,
      q: r.q,
    };
    if (includeEnergy) {
      const Tin = convertTemp(r.T_in ?? 0, units);
      const Tout = convertTemp(r.T_out ?? 0, units);
      row.T_in = Tin.value;
      row.T_out = Tout.value;
      row.TUnit = Tin.unit;
    }
    rows.push(row);
  }
  return { rows, includeEnergy, units };
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** One row per link: id, name, Q, Δp, V, Re, and temps when energy is on. */
export function resultsTableCsv(table: ResultsTable): string {
  const { rows, includeEnergy } = table;
  if (rows.length === 0) {
    return includeEnergy
      ? "id,name,Q,dP,V,Re,T_in,T_out\n"
      : "id,name,Q,dP,V,Re\n";
  }
  const qUnit = rows[0].QUnit;
  const dPUnit = rows[0].dPUnit;
  const vUnit = rows[0].VUnit;
  const headers = [
    "id",
    "name",
    `Q (${qUnit})`,
    `dP (${dPUnit})`,
    `V (${vUnit})`,
    "Re",
  ];
  if (includeEnergy) {
    const tUnit = rows[0].TUnit ?? "C";
    headers.push(`T_in (${tUnit})`, `T_out (${tUnit})`);
  }
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    const cells: (string | number)[] = [
      row.id,
      row.name,
      row.Q,
      row.dP,
      row.V,
      row.Re,
    ];
    if (includeEnergy) {
      cells.push(row.T_in ?? "", row.T_out ?? "");
    }
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

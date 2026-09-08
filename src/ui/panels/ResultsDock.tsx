import { useStore, type DockTab } from "../store";
import {
  formatFlowAir,
  formatFlowLiquid,
  formatPower,
  formatTempC,
  m3s_to_Lmin,
} from "../../engine/units";
import { DLC_PUMP_COEFFS, DLC_TOTAL_HEAT_W } from "../../engine/examples/dlcPumpedCooling";
import { WATER_30C } from "../../engine/fluids";
import { DEFAULT_UNITS, G } from "../../engine/types";
import { diffLinkResults } from "../compare";
import { downloadTextFile } from "../download";
import { buildResultsTable, resultsTableCsv } from "../results/table";

const TABS: { id: DockTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "charts", label: "Curves" },
  { id: "table", label: "Table" },
  { id: "proof", label: "Proof" },
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

function PumpChart() {
  const result = useStore((s) => s.result);
  const pump = result?.links["pump.core"];
  const w = 420;
  const h = 180;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const Qmax = 0.0004;
  const Hmax = 22;
  const pts: { Q: number; H: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const Q = (Qmax * i) / 40;
    const H = Math.max(0, DLC_PUMP_COEFFS[0] + DLC_PUMP_COEFFS[2] * Q * Q);
    pts.push({ Q, H });
  }
  const x = (Q: number) => pad.l + (Q / Qmax) * (w - pad.l - pad.r);
  const y = (H: number) => pad.t + (1 - H / Hmax) * (h - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${x(p.Q).toFixed(1)} ${y(p.H).toFixed(1)}`).join(" ");
  const Qop = pump?.Q ?? 0;
  const Hop = pump ? (result!.nodes["pump.out"].P - result!.nodes["pump.in"].P) / (WATER_30C.rho * G) : 0;
  const sys = Array.from({ length: 41 }, (_, i) => {
    const Q = (Qmax * i) / 40;
    const H = Qop > 0 ? Hop * (Q / Qop) ** 2 : 0;
    return `${i ? "L" : "M"} ${x(Q).toFixed(1)} ${y(H).toFixed(1)}`;
  }).join(" ");

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
      <text x="12" y="14" className="chart-axis">
        Head m
      </text>
      <text x={w - 70} y={h - 6} className="chart-axis">
        L/min
      </text>
      <path d={d} className="chart-pump" />
      <path d={sys} className="chart-sys" />
      {pump && <circle cx={x(Qop)} cy={y(Hop)} r="5" className="chart-op" />}
      <text x={x(Qop) + 8} y={y(Hop) - 8} className="chart-op-label">
        {m3s_to_Lmin(Qop).toFixed(1)} L/min · {Hop.toFixed(1)} m
      </text>
    </svg>
  );
}

function GpuBars() {
  const result = useStore((s) => s.result);
  if (!result) return null;
  const temps = [0, 1, 2, 3].map((i) => result.links[`gpu${i}.core`]?.T_surface ?? 0);
  const max = Math.max(...temps, 340);
  return (
    <div className="bars">
      {temps.map((T, i) => (
        <div key={i} className="bar-row">
          <span>GPU {i}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${((T - 273.15) / (max - 273.15)) * 100}%` }} />
          </div>
          <span className="mono">{formatTempC(T)}</span>
        </div>
      ))}
    </div>
  );
}

export function ResultsDock() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const result = useStore((s) => s.result);
  const report = useStore((s) => s.report);
  const project = useStore((s) => s.project);
  const exampleId = useStore((s) => s.exampleId);
  const diagram = useStore((s) => s.diagram);
  const compare = useStore((s) => s.compare);

  const hx = result?.couplings["hex.hx"];
  const pump = result?.links["pump.core"];
  const fan = result?.links["fan.core"];
  const gpu = result?.links["gpu0.core"];
  const isDlc = exampleId === "dlc-pumped-cooling" && hx && pump && fan;

  const linkCount = project?.links.length ?? 0;
  const maxQ = result
    ? Math.max(...Object.values(result.links).map((l) => Math.abs(l.Q)), 0)
    : 0;
  const airish = project?.links.some((l) => l.fluid.includes("air")) ?? false;

  const displayUnits = project?.units ?? DEFAULT_UNITS;
  const table =
    result && project ? buildResultsTable(project, result, displayUnits) : null;
  const compareRows =
    compare?.result && result
      ? diffLinkResults(
          compare.result,
          result,
          compare.project,
          project,
          displayUnits,
        )
      : null;

  function exportCsv() {
    if (!table || !project) return;
    const name = diagram.id || project.meta.name || "hydro-flow";
    downloadTextFile(`${name}-results.csv`, resultsTableCsv(table), "text/csv;charset=utf-8");
  }

  return (
    <section className="dock">
      <div className="dock-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "is-active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="dock-body">
        {tab === "summary" && result && isDlc && (
          <div className="kpi-grid">
            <Kpi label="Heat rejected" value={formatPower(hx.q)} hint={`target ${formatPower(DLC_TOTAL_HEAT_W)}`} />
            <Kpi label="Coolant flow" value={formatFlowLiquid(pump.Q)} hint="CDU pump" />
            <Kpi label="Air flow" value={formatFlowAir(fan.Q)} hint="forced convection" />
            <Kpi
              label="Supply / return"
              value={`${formatTempC(result.nodes.supplyManifold.T)}  →  ${formatTempC(result.nodes.returnManifold.T)}`}
            />
            <Kpi label="HEX effectiveness" value={hx.effectiveness.toFixed(3)} hint={`NTU ${hx.ntu.toFixed(2)}`} />
            <Kpi label="GPU case" value={gpu?.T_surface ? formatTempC(gpu.T_surface) : "—"} hint="case-to-coolant Rth" />
          </div>
        )}
        {tab === "summary" && result && !isDlc && (
          <div className="kpi-grid">
            <Kpi label="Status" value={result.status} hint={`${result.iterations} iterations`} />
            <Kpi label="Links" value={String(linkCount)} hint="solved branches" />
            <Kpi
              label="Peak |Q|"
              value={airish ? formatFlowAir(maxQ) : formatFlowLiquid(maxQ)}
              hint="largest link magnitude"
            />
            <Kpi
              label="Elapsed"
              value={`${result.elapsedMs.toFixed(0)} ms`}
              hint={`${result.iterations} iterations`}
            />
          </div>
        )}
        {tab === "charts" && isDlc && (
          <div className="charts-row">
            <div>
              <div className="panel-kicker">Pump vs system</div>
              <PumpChart />
            </div>
            <div>
              <div className="panel-kicker">GPU case temperatures</div>
              <GpuBars />
            </div>
          </div>
        )}
        {tab === "charts" && !isDlc && (
          <p className="muted">Curve charts are available on the GPU rack liquid-cooling example. Use Table for link flows.</p>
        )}
        {tab === "table" && compareRows && (
          <div className="table-panel">
            <div className="table-toolbar">
              <span className="muted">
                A = {compare?.label ?? "baseline"} · B = live · Δ = B − A
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Link</th>
                    <th>Q A</th>
                    <th>Q B</th>
                    <th>ΔQ</th>
                    <th>Δp A</th>
                    <th>Δp B</th>
                    <th>ΔΔp</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>
                        {row.Qa.toFixed(2)} {row.QUnit}
                      </td>
                      <td>
                        {row.Qb.toFixed(2)} {row.QUnit}
                      </td>
                      <td className={row.dQ === 0 ? "" : "delta"}>
                        {row.dQ >= 0 ? "+" : ""}
                        {row.dQ.toFixed(2)}
                      </td>
                      <td>
                        {row.dPa.toFixed(2)} {row.dPUnit}
                      </td>
                      <td>
                        {row.dPb.toFixed(2)} {row.dPUnit}
                      </td>
                      <td className={row.dDP === 0 ? "" : "delta"}>
                        {row.dDP >= 0 ? "+" : ""}
                        {row.dDP.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === "table" && table && !compareRows && (
          <div className="table-panel">
            <div className="table-toolbar">
              <button type="button" className="ghost" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Link</th>
                    <th>Q</th>
                    <th title="Net ΔP = P_from − P_to (loss + elev − rise).">
                      Δp {table.rows[0]?.dPUnit ?? displayUnits.pressure}
                    </th>
                    <th>V</th>
                    <th>Re</th>
                    <th title="Friction, K, emitter, and tee. Excludes elevation and pump/fan rise.">
                      Loss
                    </th>
                    <th>Rise</th>
                    {table.includeEnergy && (
                      <>
                        <th>T in</th>
                        <th>T out</th>
                        <th>q</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => {
                    const link = project!.links.find((l) => l.id === row.id);
                    const machine = !!(link?.component.pump || link?.component.fan);
                    return (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>
                          {row.Q.toFixed(row.QUnit === "cfm" ? 1 : 2)} {row.QUnit}
                        </td>
                        <td>{row.dP.toFixed(2)}</td>
                        <td>
                          {row.V.toFixed(3)} {row.VUnit}
                        </td>
                        <td>{row.Re.toFixed(0)}</td>
                        <td>{(row.loss ?? 0).toFixed(2)}</td>
                        <td>{machine ? (row.rise ?? 0).toFixed(2) : "—"}</td>
                        {table.includeEnergy && (
                          <>
                            <td>
                              {row.T_in !== undefined ? `${row.T_in.toFixed(2)} ${row.TUnit}` : "—"}
                            </td>
                            <td>
                              {row.T_out !== undefined ? `${row.T_out.toFixed(2)} ${row.TUnit}` : "—"}
                            </td>
                            <td>{row.q ? formatPower(row.q) : "—"}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === "proof" && report && (
          <ul className="proof-list">
            {report.checks.map((c) => (
              <li key={c.id} className={c.pass ? "pass" : "fail"}>
                <span className="tick">{c.pass ? "✓" : "✗"}</span>
                <span>{c.label}</span>
                <span className="mono">
                  {Number.isFinite(c.actual) ? c.actual.toPrecision(5) : "—"}
                  {c.unit ? ` ${c.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!result && tab !== "proof" && <p className="muted">Solve the network to fill this pane.</p>}
      </div>
    </section>
  );
}

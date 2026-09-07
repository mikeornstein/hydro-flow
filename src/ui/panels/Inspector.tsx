import type { DiagramEdge, DiagramNode } from "../../diagram/types";
import { useStore } from "../store";
import {
  formatFlowAir,
  formatFlowLiquid,
  formatPower,
  formatPressure,
  formatTempC,
  KtoC,
} from "../../engine/units";

function Field({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function NodeForm({ node }: { node: DiagramNode }) {
  const patchNode = useStore((s) => s.patchNode);
  const p = node.params;
  const set = (params: DiagramNode["params"]) => patchNode(node.id, { params });
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input value={node.name} onChange={(e) => patchNode(node.id, { name: e.target.value })} />
      </label>
      <Field label="Elevation z (m)" value={node.z} onChange={(z) => patchNode(node.id, { z })} />
      {(node.kind === "boundary" || node.kind === "tank") && (
        <>
          <Field
            label="Fixed P (Pa abs)"
            value={p.pFixed ?? 101325}
            onChange={(v) => set({ pFixed: v })}
            step={100}
          />
          {node.kind === "boundary" && (
            <Field
              label="Fixed T (K)"
              value={p.tFixed ?? 298.15}
              onChange={(v) => set({ tFixed: v })}
              step={0.1}
            />
          )}
        </>
      )}
      {node.kind === "pump" && (
        <>
          <Field label="Shutoff head (m)" value={p.pump?.coeffs[0] ?? 0} onChange={(v) => set({ pump: { coeffs: [v, 0, p.pump?.coeffs[2] ?? -1e8] } })} />
          <Field
            label="Quadratic coeff (m / (m³/s)²)"
            value={p.pump?.coeffs[2] ?? 0}
            onChange={(v) => set({ pump: { coeffs: [p.pump?.coeffs[0] ?? 20, 0, v] } })}
            step={1e6}
          />
          <Field label="Internal K" value={p.K ?? 0} onChange={(K) => set({ K })} />
        </>
      )}
      {node.kind === "fan" && (
        <>
          <Field label="Stall ΔP (Pa)" value={p.fan?.coeffs[0] ?? 0} onChange={(v) => set({ fan: { coeffs: [v, 0, p.fan?.coeffs[2] ?? -5000] } })} step={1} />
          <Field
            label="Quadratic coeff (Pa / (m³/s)²)"
            value={p.fan?.coeffs[2] ?? 0}
            onChange={(v) => set({ fan: { coeffs: [p.fan?.coeffs[0] ?? 200, 0, v] } })}
            step={10}
          />
        </>
      )}
      {node.kind === "coldPlate" && (
        <>
          <Field label="Heat (W)" value={p.q ?? 0} onChange={(q) => set({ q })} step={10} />
          <Field label="Rth (K/W)" value={p.rTh ?? 0} onChange={(rTh) => set({ rTh })} step={0.001} />
          <Field label="Length (m)" value={p.L ?? 0} onChange={(L) => set({ L })} />
          <Field label="Dh (m)" value={p.D ?? 0} onChange={(D) => set({ D })} step={0.001} />
          <Field label="K" value={p.K ?? 0} onChange={(K) => set({ K })} />
        </>
      )}
      {node.kind === "heatExchanger" && (
        <>
          <Field label="UA (W/K)" value={p.ua ?? 0} onChange={(ua) => set({ ua })} step={10} />
          <Field label="Liquid K" value={p.liquidK ?? 0} onChange={(liquidK) => set({ liquidK })} />
          <Field label="Air rQuad" value={p.airRQuad ?? 0} onChange={(airRQuad) => set({ airRQuad })} step={10} />
        </>
      )}
      {(node.kind === "valve" || node.kind === "filter" || node.kind === "orifice") && (
        <>
          <Field label="K" value={p.K ?? 0} onChange={(K) => set({ K })} />
          <Field label="D (m)" value={p.D ?? 0} onChange={(D) => set({ D })} step={0.001} />
          {node.kind === "valve" && (
            <Field label="Opening (0–1)" value={p.opening ?? 1} onChange={(opening) => set({ opening })} step={0.05} />
          )}
        </>
      )}
    </>
  );
}

function EdgeForm({ edge }: { edge: DiagramEdge }) {
  const patchEdge = useStore((s) => s.patchEdge);
  const g = edge.geometry;
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input value={edge.name ?? ""} onChange={(e) => patchEdge(edge.id, { name: e.target.value })} />
      </label>
      <Field label="Length (m)" value={g.L} onChange={(L) => patchEdge(edge.id, { geometry: { ...g, L } })} />
      <Field label="Diameter (m)" value={g.D} onChange={(D) => patchEdge(edge.id, { geometry: { ...g, D } })} step={0.001} />
      <Field label="Roughness ε (m)" value={g.eps} onChange={(eps) => patchEdge(edge.id, { geometry: { ...g, eps } })} step={1e-6} />
      <Field label="Minor-loss K" value={g.K} onChange={(K) => patchEdge(edge.id, { geometry: { ...g, K } })} />
    </>
  );
}

export function Inspector() {
  const diagram = useStore((s) => s.diagram);
  const result = useStore((s) => s.result);
  const selectedId = useStore((s) => s.selectedId);
  const selectedKind = useStore((s) => s.selectedKind);
  const node = diagram.nodes.find((n) => n.id === selectedId);
  const edge = diagram.edges.find((e) => e.id === selectedId);

  if (!selectedId || !selectedKind) {
    return (
      <aside className="inspector">
        <div className="panel-kicker">Inspector</div>
        <p className="muted">Select a component or run to edit geometry, curves, and heat.</p>
      </aside>
    );
  }

  const live =
    selectedKind === "node" && node
      ? node.kind === "coldPlate"
        ? result?.links[`${node.id}.core`]
        : node.kind === "heatExchanger"
          ? result?.couplings[`${node.id}.hx`]
          : result?.links[`${node.id}.core`] ?? result?.nodes[node.id]
      : edge
        ? result?.links[edge.id]
        : null;

  return (
    <aside className="inspector">
      <div className="panel-kicker">Inspector</div>
      <h2>{node?.name ?? edge?.name ?? selectedId}</h2>
      <div className="kicker-2">{node?.kind ?? edge?.kind}</div>
      {node && <NodeForm node={node} />}
      {edge && <EdgeForm edge={edge} />}
      {live && "Q" in live && live.Q !== undefined && (
        <div className="live-block">
          <div className="panel-kicker">Last solve</div>
          <dl className="kv">
            <dt>Flow</dt>
            <dd>{(node?.fluid ?? edge?.fluid ?? "").includes("air") ? formatFlowAir(live.Q) : formatFlowLiquid(live.Q)}</dd>
            {"dP" in live && live.dP !== undefined && (
              <>
                <dt>ΔP</dt>
                <dd>{formatPressure(Math.abs(live.dP))}</dd>
              </>
            )}
            {"T_in" in live && live.T_in !== undefined && (
              <>
                <dt>T in / out</dt>
                <dd>
                  {formatTempC(live.T_in)} → {formatTempC(live.T_out ?? live.T_in)}
                </dd>
              </>
            )}
            {"T_surface" in live && live.T_surface !== undefined && (
              <>
                <dt>Case</dt>
                <dd>{formatTempC(live.T_surface)}</dd>
              </>
            )}
            {"q" in live && live.q !== undefined && (
              <>
                <dt>Heat</dt>
                <dd>{formatPower(live.q)}</dd>
              </>
            )}
            {"Re" in live && live.Re !== undefined && (
              <>
                <dt>Re</dt>
                <dd>{live.Re.toFixed(0)}</dd>
              </>
            )}
          </dl>
        </div>
      )}
      {live && "effectiveness" in live && (
        <div className="live-block">
          <div className="panel-kicker">HEX</div>
          <dl className="kv">
            <dt>q</dt>
            <dd>{formatPower(live.q)}</dd>
            <dt>ε / NTU</dt>
            <dd>
              {live.effectiveness.toFixed(3)} / {live.ntu.toFixed(2)}
            </dd>
            <dt>Liquid</dt>
            <dd>
              {KtoC(live.T_hot_in).toFixed(2)} → {KtoC(live.T_hot_out).toFixed(2)} °C
            </dd>
            <dt>Air</dt>
            <dd>
              {KtoC(live.T_cold_in).toFixed(2)} → {KtoC(live.T_cold_out).toFixed(2)} °C
            </dd>
          </dl>
        </div>
      )}
    </aside>
  );
}

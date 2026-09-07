import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  sampleProject,
  type Project,
  type SolveResult,
} from "@hydro-flow/solver";

type WorkerReply =
  | { ok: true; result: SolveResult }
  | { ok: false; error: string };

const kPa = (pa: number) => (pa / 1000).toFixed(1);
const lps = (m3s: number) => (m3s * 1000).toFixed(2);

function buildNodes(project: Project, result: SolveResult | null): Node[] {
  return project.nodes.map((n) => {
    const res = result?.nodes[n.id];
    const isBoundary = n.kind === "boundary";
    return {
      id: n.id,
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      data: {
        label: (
          <div style={{ textAlign: "center", lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600 }}>{n.id}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{n.kind}</div>
            {res && (
              <div style={{ fontSize: 11, marginTop: 2, color: "#0b7285" }}>
                P = {kPa(res.P)} kPa
              </div>
            )}
          </div>
        ),
      },
      style: {
        borderRadius: isBoundary ? 6 : 999,
        border: `2px solid ${isBoundary ? "#1971c2" : "#495057"}`,
        background: isBoundary ? "#e7f5ff" : "#f1f3f5",
        width: 120,
        padding: 6,
        fontSize: 12,
      },
    };
  });
}

function buildEdges(project: Project, result: SolveResult | null): Edge[] {
  return project.links.map((l) => {
    const res = result?.links[l.id];
    const reversed = res ? res.Q < 0 : false;
    const label = res
      ? `${l.id}: Q=${lps(Math.abs(res.Q))} L/s  ΔP=${kPa(res.dP)} kPa`
      : l.id;
    return {
      id: l.id,
      source: reversed ? l.to : l.from,
      target: reversed ? l.from : l.to,
      label,
      animated: !!res && Math.abs(res.Q) > 1e-9,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: res ? "#1c7ed6" : "#adb5bd", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#212529" },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.85 },
    };
  });
}

export function App() {
  const [project] = useState<Project>(() => sampleProject());
  const [result, setResult] = useState<SolveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("./solver.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return workerRef.current;
  }, []);

  const solve = useCallback(() => {
    setBusy(true);
    setError(null);
    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      setBusy(false);
      if (e.data.ok) setResult(e.data.result);
      else setError(e.data.error);
    };
    worker.postMessage(project);
  }, [getWorker, project]);

  const nodes = useMemo(() => buildNodes(project, result), [project, result]);
  const edges = useMemo(() => buildEdges(project, result), [project, result]);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      <aside
        style={{
          width: 340,
          borderLeft: "1px solid #dee2e6",
          padding: 16,
          overflowY: "auto",
          background: "#fff",
        }}
      >
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>hydro-flow</h1>
        <p style={{ fontSize: 12, color: "#868e96", marginTop: 0 }}>
          Flow Network Modeling — {project.meta?.name}
        </p>

        <button
          onClick={solve}
          disabled={busy}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: busy ? "#adb5bd" : "#1c7ed6",
            border: "none",
            borderRadius: 6,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Solving…" : "Solve network"}
        </button>

        {error && (
          <div style={{ marginTop: 12, color: "#e03131", fontSize: 13 }}>
            Error: {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16 }}>
            <div
              data-testid="solve-status"
              style={{
                fontSize: 13,
                padding: "6px 8px",
                borderRadius: 6,
                background: result.status === "converged" ? "#ebfbee" : "#fff4e6",
                color: result.status === "converged" ? "#2b8a3e" : "#e8590c",
              }}
            >
              Status: <strong>{result.status}</strong> · {result.iterations} iters ·{" "}
              {result.elapsedMs.toFixed(1)} ms
            </div>

            <h2 style={{ fontSize: 14, margin: "16px 0 6px" }}>Link results</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#495057" }}>
                  <th style={th}>Link</th>
                  <th style={th}>Q (L/s)</th>
                  <th style={th}>V (m/s)</th>
                  <th style={th}>Re</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.links).map(([id, r]) => (
                  <tr key={id}>
                    <td style={td}>{id}</td>
                    <td style={td}>{lps(r.Q)}</td>
                    <td style={td}>{r.V.toFixed(2)}</td>
                    <td style={td}>{Math.round(r.Re).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={{ fontSize: 14, margin: "16px 0 6px" }}>Residual log</h2>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                background: "#f8f9fa",
                borderRadius: 6,
                padding: 8,
                maxHeight: 140,
                overflowY: "auto",
              }}
            >
              {result.residuals.map((r, i) => (
                <div key={i}>
                  it {String(i + 1).padStart(2, " ")}: {r.toExponential(3)}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const th: CSSProperties = { borderBottom: "1px solid #dee2e6", padding: "4px 6px" };
const td: CSSProperties = { borderBottom: "1px solid #f1f3f5", padding: "4px 6px" };

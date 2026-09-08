import { useStore } from "../store";
import { ProjectControls } from "./ProjectControls";

export function Toolbar() {
  const diagram = useStore((s) => s.diagram);
  const result = useStore((s) => s.result);
  const solving = useStore((s) => s.solving);
  const error = useStore((s) => s.error);
  const compare = useStore((s) => s.compare);
  const solve = useStore((s) => s.solve);
  const swapCompare = useStore((s) => s.swapCompare);
  const clearCompare = useStore((s) => s.clearCompare);

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">hf</span>
        <div>
          <div className="brand-name">
            hydro<span>flow</span>
          </div>
          <div className="brand-sub">flow network modeling</div>
        </div>
      </div>
      <div className="project-meta">
        <div className="project-name">{diagram.name}</div>
        <div className="project-desc">{diagram.description}</div>
      </div>
      <div className="toolbar-actions">
        {error && <span className="pill danger">{error}</span>}
        {compare && (
          <span className="pill compare" title={`Baseline: ${compare.label}`}>
            Comparing · {compare.label} ↔ live
            <button type="button" className="pill-action" onClick={() => swapCompare()}>
              Swap
            </button>
            <button type="button" className="pill-action" onClick={() => clearCompare()}>
              Clear
            </button>
          </span>
        )}
        {result && (
          <span className={`pill ${result.status === "converged" ? "ok" : "warn"}`}>
            {result.status} · {result.iterations} iter · {result.elapsedMs.toFixed(0)} ms
          </span>
        )}
        <ProjectControls />
        <button type="button" className="btn primary" onClick={solve} disabled={solving}>
          {solving ? "Solving…" : "Solve"}
        </button>
      </div>
    </header>
  );
}

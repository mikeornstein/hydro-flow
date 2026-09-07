import { useStore } from "../store";
import { ProjectControls } from "./ProjectControls";

export function Toolbar() {
  const diagram = useStore((s) => s.diagram);
  const result = useStore((s) => s.result);
  const solving = useStore((s) => s.solving);
  const error = useStore((s) => s.error);
  const solve = useStore((s) => s.solve);

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

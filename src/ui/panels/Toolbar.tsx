import { useStore } from "../store";
import { exampleGroups } from "../examples/catalog";

export function Toolbar() {
  const diagram = useStore((s) => s.diagram);
  const exampleId = useStore((s) => s.exampleId);
  const result = useStore((s) => s.result);
  const solving = useStore((s) => s.solving);
  const error = useStore((s) => s.error);
  const solve = useStore((s) => s.solve);
  const loadExample = useStore((s) => s.loadExample);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const groups = exampleGroups();

  function save() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${diagram.id || "hydro-flow"}.json`;
    a.click();
  }

  function open() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      importJson(await file.text());
    };
    input.click();
  }

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
        <label className="example-picker">
          <span className="example-picker-label">Example</span>
          <select
            className="example-select"
            value={exampleId}
            aria-label="Load example network"
            onChange={(e) => {
              const id = e.target.value;
              if (id && id !== "custom") loadExample(id);
            }}
          >
            {exampleId === "custom" && <option value="custom">Custom network</option>}
            {groups.map(({ group, entries }) => (
              <optgroup key={group} label={group}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id} title={entry.description}>
                    {entry.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button type="button" className="btn ghost" onClick={open}>
          Open
        </button>
        <button type="button" className="btn ghost" onClick={save}>
          Save
        </button>
        <button type="button" className="btn primary" onClick={solve} disabled={solving}>
          {solving ? "Solving…" : "Solve"}
        </button>
      </div>
    </header>
  );
}

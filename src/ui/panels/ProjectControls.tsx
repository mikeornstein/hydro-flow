import { useStore } from "../store";
import { exampleGroups } from "../examples/catalog";
import { DISCARD_MESSAGE, isDirty } from "../unsaved";

export interface ProjectControlsProps {
  /** Runs after a successful example load or file import, not after Save. */
  onProjectLoaded?(): void;
}

export function ProjectControls({ onProjectLoaded }: ProjectControlsProps) {
  const diagram = useStore((s) => s.diagram);
  const exampleId = useStore((s) => s.exampleId);
  const loadExample = useStore((s) => s.loadExample);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const duplicateForCompare = useStore((s) => s.duplicateForCompare);
  const groups = exampleGroups();

  function save() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${diagram.id || "hydro-flow"}.json`;
    a.click();
    useStore.getState().markSaved();
  }

  function open() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      let parsed: { nodes?: unknown; edges?: unknown };
      try {
        parsed = JSON.parse(text) as { nodes?: unknown; edges?: unknown };
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
        return;
      }
      if (!parsed.nodes || !parsed.edges) {
        window.alert("Not a hydro-flow diagram");
        return;
      }
      if (isDirty(useStore.getState()) && !window.confirm(DISCARD_MESSAGE)) return;
      importJson(text);
      onProjectLoaded?.();
    };
    input.click();
  }

  return (
    <div className="project-controls">
      <label className="example-picker">
        <span className="example-picker-label">Example</span>
        <select
          className="example-select"
          value={exampleId}
          aria-label="Load example network"
          onChange={(e) => {
            const id = e.target.value;
            if (!id || id === "custom") return;
            if (isDirty(useStore.getState()) && !window.confirm(DISCARD_MESSAGE)) return;
            loadExample(id);
            onProjectLoaded?.();
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
      <button
        type="button"
        className="btn ghost"
        title="Keep a baseline and edit a what-if copy"
        onClick={() => duplicateForCompare()}
      >
        Duplicate
      </button>
    </div>
  );
}

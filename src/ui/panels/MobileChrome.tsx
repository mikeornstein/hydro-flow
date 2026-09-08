import type { EquipmentKind } from "../../diagram/types";
import { SheetHost } from "../layout/SheetHost";
import type { SheetId, SheetLayout } from "../layout/model";
import { useStore } from "../store";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { ProjectControls } from "./ProjectControls";
import { ResultsDock } from "./ResultsDock";

export interface MobileChromeProps {
  layout: SheetLayout;
}

const KIND_LABEL: Record<EquipmentKind, string> = {
  junction: "Junction",
  boundary: "Boundary",
  tank: "Tank",
  pump: "Pump",
  fan: "Fan",
  valve: "Valve",
  filter: "Filter",
  orifice: "Orifice",
  coldPlate: "Cold plate",
  heatExchanger: "Air–liquid HEX",
};

function assertNever(value: never): never {
  throw new Error(`unexpected sheet: ${String(value)}`);
}

export function CompactHeader({ layout }: { layout: SheetLayout }) {
  const diagram = useStore((s) => s.diagram);
  const error = useStore((s) => s.error);
  const compare = useStore((s) => s.compare);
  const swapCompare = useStore((s) => s.swapCompare);
  const clearCompare = useStore((s) => s.clearCompare);
  const projectOpen = layout.sheet.status === "open" && layout.sheet.id === "project";

  return (
    <header className="compact-header">
      <div className="brand">
        <span className="brand-mark">hf</span>
        <div>
          <div className="brand-name">
            hydro<span>flow</span>
          </div>
          <div className="project-name">{diagram.name}</div>
        </div>
      </div>
      <div className="compact-header-status">
        {error && (
          <span className="pill danger" title={error}>
            {error.length > 48 ? `${error.slice(0, 45)}…` : error}
          </span>
        )}
        {compare && (
          <span className="pill compare" title={`Baseline: ${compare.label}`}>
            Compare
            <button type="button" className="pill-action" onClick={() => swapCompare()}>
              Swap
            </button>
            <button type="button" className="pill-action" onClick={() => clearCompare()}>
              Clear
            </button>
          </span>
        )}
        <button
          type="button"
          className="btn ghost compact-ctl"
          aria-pressed={projectOpen}
          onClick={() => layout.toggleSheet("project")}
        >
          Project
        </button>
      </div>
    </header>
  );
}

function MobileContextBar({
  layout,
}: {
  layout: SheetLayout;
}) {
  const pendingKind = useStore((s) => s.pendingKind);
  const setPendingKind = useStore((s) => s.setPendingKind);
  const selectedId = useStore((s) => s.selectedId);
  const selectedKind = useStore((s) => s.selectedKind);
  const diagram = useStore((s) => s.diagram);

  if (pendingKind) {
    return (
      <div className="mobile-context" role="status">
        <span>Tap canvas to place {KIND_LABEL[pendingKind]}</span>
        <button type="button" className="btn ghost" onClick={() => setPendingKind(null)}>
          Cancel
        </button>
      </div>
    );
  }

  if (!selectedId || !selectedKind) return null;

  const node = diagram.nodes.find((n) => n.id === selectedId);
  const edge = diagram.edges.find((e) => e.id === selectedId);
  const name = node?.name ?? edge?.name ?? selectedId;

  return (
    <div className="mobile-context">
      <span className="mobile-context-name">{name}</span>
      <button type="button" className="btn ghost" onClick={() => layout.openSheet("inspector")}>
        Inspect
      </button>
      <button type="button" className="btn ghost" onClick={() => layout.openSheet("confirm-remove")}>
        Remove
      </button>
    </div>
  );
}

function RemoveSelection({
  onCancel,
  onConfirm,
}: {
  onCancel(): void;
  onConfirm(): void;
}) {
  const selectedId = useStore((s) => s.selectedId);
  const selectedKind = useStore((s) => s.selectedKind);
  const diagram = useStore((s) => s.diagram);
  const node = diagram.nodes.find((n) => n.id === selectedId);
  const edge = diagram.edges.find((e) => e.id === selectedId);
  const name = node?.name ?? edge?.name ?? selectedId ?? "this item";
  const attached = node
    ? diagram.edges.filter((e) => e.from.node === node.id || e.to.node === node.id).length
    : 0;

  return (
    <div className="remove-confirm">
      {selectedKind === "edge" ? (
        <p>Remove the run “{name}”? This cannot be undone.</p>
      ) : (
        <p>
          Remove “{name}”?
          {attached > 0
            ? ` ${attached} attached run${attached === 1 ? "" : "s"} will also be removed.`
            : ""}
        </p>
      )}
      <div className="remove-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn danger" onClick={onConfirm}>
          Remove
        </button>
      </div>
    </div>
  );
}

function SheetContents({ id, layout }: { id: SheetId; layout: SheetLayout }) {
  const removeSelected = useStore((s) => s.removeSelected);
  const selectedId = useStore((s) => s.selectedId);

  switch (id) {
    case "library":
      return <Palette onChoose={layout.closeSheet} />;
    case "inspector":
      return (
        <div className="inspector-sheet">
          <Inspector />
          {selectedId && (
            <button
              type="button"
              className="btn ghost remove-in-sheet"
              onClick={() => layout.openSheet("confirm-remove")}
            >
              Remove selected
            </button>
          )}
        </div>
      );
    case "results":
      return <ResultsDock />;
    case "project":
      return <ProjectControls onProjectLoaded={layout.closeSheet} />;
    case "confirm-remove":
      return (
        <RemoveSelection
          onCancel={layout.closeSheet}
          onConfirm={() => {
            removeSelected();
            layout.closeSheet();
          }}
        />
      );
    default:
      return assertNever(id);
  }
}

export function MobileChrome({ layout }: MobileChromeProps) {
  const solve = useStore((s) => s.solve);
  const solving = useStore((s) => s.solving);
  const result = useStore((s) => s.result);
  const error = useStore((s) => s.error);
  const selectedId = useStore((s) => s.selectedId);
  const sheetId = layout.sheet.status === "open" ? layout.sheet.id : null;
  const solved = !error && result?.status === "converged";
  const solveLabel = solving ? "Solving…" : error ? "Retry" : solved ? "Solved" : "Solve";
  const solveClass = [
    "mobile-action",
    "primary",
    solved ? "is-solved" : "",
    error ? "is-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mobile-chrome">
      {layout.sheet.status === "closed" && <MobileContextBar layout={layout} />}
      <nav className="mobile-actions" aria-label="Network actions">
        <button
          type="button"
          className="mobile-action"
          aria-pressed={sheetId === "library"}
          onClick={() => layout.toggleSheet("library")}
        >
          Library
        </button>
        <button
          type="button"
          className="mobile-action"
          disabled={!selectedId}
          aria-pressed={sheetId === "inspector"}
          onClick={() => layout.toggleSheet("inspector")}
        >
          Inspect
        </button>
        <button
          type="button"
          className={solveClass}
          onClick={solve}
          disabled={solving}
          title={error ?? (result ? `${result.status} · ${result.iterations} iter` : undefined)}
        >
          {solveLabel}
        </button>
        <button
          type="button"
          className="mobile-action"
          aria-pressed={sheetId === "results"}
          onClick={() => layout.toggleSheet("results")}
        >
          Results
        </button>
      </nav>
      <SheetHost
        state={layout.sheet}
        onDismiss={layout.closeSheet}
        render={(id) => <SheetContents id={id} layout={layout} />}
      />
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from "react";
import type { SheetId, SheetState } from "./model";

type SheetDetent = "compact" | "medium" | "large";

type SheetPresentation = {
  title: string;
  detent: SheetDetent;
};

export const SHEETS = {
  library: { title: "Component library", detent: "medium" },
  inspector: { title: "Inspector", detent: "large" },
  results: { title: "Results", detent: "large" },
  project: { title: "Project", detent: "medium" },
  "confirm-remove": { title: "Remove selection", detent: "compact" },
} satisfies Record<SheetId, SheetPresentation>;

export interface SheetHostProps {
  state: SheetState;
  onDismiss(): void;
  render(id: SheetId): ReactNode;
}

/** iOS Safari's bottom chrome sits over layout-viewport bottom:0; lift the sheet into the visual viewport. */
function syncDialogToVisualViewport(dialog: HTMLDialogElement) {
  const vv = window.visualViewport;
  if (!vv) {
    dialog.style.bottom = "0px";
    return;
  }
  const obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  dialog.style.bottom = `${obscured}px`;
}

export function SheetHost({ state, onDismiss, render }: SheetHostProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = state.status === "open";
  const id = open ? state.id : null;
  const meta = id ? SHEETS[id] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      syncDialogToVisualViewport(dialog);
      const vv = window.visualViewport;
      const onViewport = () => syncDialogToVisualViewport(dialog);
      vv?.addEventListener("resize", onViewport);
      vv?.addEventListener("scroll", onViewport);
      window.addEventListener("resize", onViewport);
      return () => {
        vv?.removeEventListener("resize", onViewport);
        vv?.removeEventListener("scroll", onViewport);
        window.removeEventListener("resize", onViewport);
        if (dialog.open) dialog.close();
        dialog.style.bottom = "";
      };
    }
    if (dialog.open) dialog.close();
    dialog.style.bottom = "";
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`sheet-dialog detent-${meta?.detent ?? "medium"}`}
      aria-labelledby="sheet-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (outside) onDismiss();
      }}
    >
      {open && id && meta && (
        <>
          <header className="sheet-header">
            <h2 id="sheet-dialog-title">{meta.title}</h2>
            <button type="button" className="sheet-close" aria-label="Close" onClick={onDismiss}>
              Close
            </button>
          </header>
          <div className="sheet-body">{render(id)}</div>
        </>
      )}
    </dialog>
  );
}

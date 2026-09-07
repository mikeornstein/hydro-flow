import { useCallback, useEffect, useReducer } from "react";

/** Structural chrome, named for shape rather than device class. */
export type LayoutMode = "rail" | "sheet";

export type SheetId =
  | "library"
  | "inspector"
  | "results"
  | "project"
  | "confirm-remove";

export type SheetState = { status: "closed" } | { status: "open"; id: SheetId };

export type RailLayout = {
  readonly mode: "rail";
};

export type SheetLayout = {
  readonly mode: "sheet";
  readonly sheet: SheetState;
  openSheet(id: SheetId): void;
  toggleSheet(id: SheetId): void;
  closeSheet(): void;
};

export type LayoutController = RailLayout | SheetLayout;

export type LayoutSnapshot = RailLayout | { mode: "sheet"; sheet: SheetState };

export type LayoutEvent =
  | { type: "viewport-changed"; mode: LayoutMode }
  | { type: "open"; id: SheetId }
  | { type: "toggle"; id: SheetId }
  | { type: "close" };

export const RAIL_MIN_WIDTH = 900;
export const RAIL_MIN_HEIGHT = 600;

// Both floors so landscape phones (e.g. 874×402) stay on sheets.
export const RAIL_MEDIA =
  `(min-width: ${RAIL_MIN_WIDTH}px) and (min-height: ${RAIL_MIN_HEIGHT}px)` as const;

export function isRailViewport(width: number, height: number): boolean {
  return width >= RAIL_MIN_WIDTH && height >= RAIL_MIN_HEIGHT;
}

export function reduceLayout(state: LayoutSnapshot, event: LayoutEvent): LayoutSnapshot {
  switch (event.type) {
    case "viewport-changed": {
      if (event.mode === "rail") return { mode: "rail" };
      if (state.mode === "sheet") return state;
      return { mode: "sheet", sheet: { status: "closed" } };
    }
    case "open": {
      if (state.mode !== "sheet") return state;
      if (state.sheet.status === "open" && state.sheet.id === event.id) return state;
      return { mode: "sheet", sheet: { status: "open", id: event.id } };
    }
    case "toggle": {
      if (state.mode !== "sheet") return state;
      if (state.sheet.status === "open" && state.sheet.id === event.id) {
        return { mode: "sheet", sheet: { status: "closed" } };
      }
      return { mode: "sheet", sheet: { status: "open", id: event.id } };
    }
    case "close": {
      if (state.mode !== "sheet") return state;
      if (state.sheet.status === "closed") return state;
      return { mode: "sheet", sheet: { status: "closed" } };
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function readViewportMode(): LayoutMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "sheet";
  }
  return window.matchMedia(RAIL_MEDIA).matches ? "rail" : "sheet";
}

function initialSnapshot(): LayoutSnapshot {
  return readViewportMode() === "rail"
    ? { mode: "rail" }
    : { mode: "sheet", sheet: { status: "closed" } };
}

export function useLayout(): LayoutController {
  const [state, dispatch] = useReducer(reduceLayout, undefined, initialSnapshot);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(RAIL_MEDIA);
    const sync = () => {
      dispatch({ type: "viewport-changed", mode: media.matches ? "rail" : "sheet" });
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const openSheet = useCallback((id: SheetId) => {
    dispatch({ type: "open", id });
  }, []);
  const toggleSheet = useCallback((id: SheetId) => {
    dispatch({ type: "toggle", id });
  }, []);
  const closeSheet = useCallback(() => {
    dispatch({ type: "close" });
  }, []);

  if (state.mode === "rail") return { mode: "rail" };
  return {
    mode: "sheet",
    sheet: state.sheet,
    openSheet,
    toggleSheet,
    closeSheet,
  };
}

import { useEffect, useRef } from "react";
import type { Diagram } from "../diagram/types";

/** Opaque canonical JSON of a Diagram. Not interchangeable with exportJson() output. */
export type DiagramFingerprint = string & { readonly __brand: "DiagramFingerprint" };

export const DISCARD_MESSAGE = "Discard unsaved changes to this network?";

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const item = obj[key];
    if (item === undefined) continue;
    sorted[key] = canonicalize(item);
  }
  return sorted;
}

export function diagramFingerprint(diagram: Diagram): DiagramFingerprint {
  return JSON.stringify(canonicalize(diagram)) as DiagramFingerprint;
}

export function isDirty(state: { diagram: Diagram; baseline: DiagramFingerprint }): boolean {
  return diagramFingerprint(state.diagram) !== state.baseline;
}

export function confirmDiscard(confirm?: (msg: string) => boolean): boolean {
  const ask = confirm ?? ((msg) => window.confirm(msg));
  return ask(DISCARD_MESSAGE);
}

export function runReplace(opts: {
  isDirty: boolean;
  confirm: (msg: string) => boolean;
  apply: () => void;
}): boolean {
  if (opts.isDirty && !opts.confirm(DISCARD_MESSAGE)) return false;
  opts.apply();
  return true;
}

export function useUnloadWarning(isDirtyNow: () => boolean): void {
  const latest = useRef(isDirtyNow);
  latest.current = isDirtyNow;
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!latest.current()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}

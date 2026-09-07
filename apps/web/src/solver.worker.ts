import { solveSteady, type Project, type SolveResult } from "@hydro-flow/solver";

self.onmessage = (e: MessageEvent<Project>) => {
  try {
    const result: SolveResult = solveSteady(e.data);
    (self as unknown as Worker).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

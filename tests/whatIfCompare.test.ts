import { describe, expect, it } from "vitest";
import { useStore } from "../src/ui/store";
import { diffLinkResults } from "../src/ui/compare";
import { DEFAULT_UNITS } from "../src/engine/types";
import goldensJson from "./fixtures/goldens.json";

const goldenA = goldensJson.cases.find((c) => c.id === "A-series-pipes")!;
const expectedQ = goldenA.expected!.links!["pipe-1"].Q!;

describe("what-if compare (ORN-26 W9 / workflow E7)", () => {
  it("duplicate + raise upstream pFixed 10% shows ΔQ; both results remain; swap restores A", () => {
    useStore.getState().loadExample("series-pipes");
    const base = useStore.getState();
    expect(base.result?.status).toBe("converged");
    const q0 = base.result!.links["pipe-1"].Q;
    expect(Math.abs(q0 - expectedQ) / expectedQ).toBeLessThanOrEqual(0.01);

    useStore.getState().duplicateForCompare();
    let s = useStore.getState();
    expect(s.compare).not.toBeNull();
    expect(s.compare!.result).not.toBeNull();
    expect(s.diagram.name).toMatch(/what-if/i);
    expect(s.tab).toBe("table");

    const node = s.diagram.nodes.find((n) => n.id === "res-hi")!;
    const p0 = node.params.pFixed!;
    useStore.getState().patchNode("res-hi", { params: { pFixed: p0 * 1.1 } });
    useStore.getState().solve();
    s = useStore.getState();

    expect(s.compare?.result).not.toBeNull();
    expect(s.result).not.toBeNull();
    expect(s.result).not.toBe(s.compare!.result);
    const qA = s.compare!.result!.links["pipe-1"].Q;
    const qB = s.result!.links["pipe-1"].Q;
    expect(qB).toBeGreaterThan(qA);
    expect(Math.abs(qA - expectedQ) / expectedQ).toBeLessThanOrEqual(0.01);

    const rows = diffLinkResults(
      s.compare!.result!,
      s.result!,
      s.compare!.project,
      s.project,
      DEFAULT_UNITS,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const pipe1 = rows.find((r) => r.id === "pipe-1")!;
    expect(pipe1.dQ).toBeGreaterThan(0);

    useStore.getState().swapCompare();
    s = useStore.getState();
    expect(s.result!.links["pipe-1"].Q).toBeCloseTo(qA, 12);
    expect(s.compare!.result!.links["pipe-1"].Q).toBeCloseTo(qB, 12);

    useStore.getState().loadExample("parallel-pipes");
    expect(useStore.getState().compare).toBeNull();
  });
});

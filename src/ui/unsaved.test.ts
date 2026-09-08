import { describe, expect, it, vi } from "vitest";
import type { Diagram } from "../diagram/types";
import { EXAMPLE_CATALOG, loadExamplePayload } from "./examples/catalog";
import { useStore } from "./store";
import {
  DISCARD_MESSAGE,
  confirmDiscard,
  diagramFingerprint,
  isDirty,
  runReplace,
} from "./unsaved";

function stock(id: string): Diagram {
  return loadExamplePayload(id).diagram;
}

describe("diagramFingerprint", () => {
  it("is stable across object key insertion order", () => {
    const left: Diagram = {
      id: "d",
      name: "n",
      description: "x",
      nodes: [
        {
          z: 0,
          y: 1,
          x: 2,
          id: "n1",
          kind: "junction",
          name: "J",
          fluid: "water",
          params: { K: 1, D: 0.02 },
        },
      ],
      edges: [],
    };
    const right: Diagram = {
      description: "x",
      edges: [],
      id: "d",
      name: "n",
      nodes: [
        {
          fluid: "water",
          id: "n1",
          kind: "junction",
          name: "J",
          params: { D: 0.02, K: 1 },
          x: 2,
          y: 1,
          z: 0,
        },
      ],
    };
    expect(diagramFingerprint(left)).toBe(diagramFingerprint(right));
  });

  it("treats an undefined property and a missing property alike", () => {
    const base = stock("series-pipes");
    const missing = { ...base };
    const withUndef = { ...base, description: undefined as unknown as string };
    expect(diagramFingerprint(withUndef)).toBe(diagramFingerprint(missing));
  });
});

describe("isDirty", () => {
  it("treats a stock diagram as clean against its own fingerprint", () => {
    const diagram = stock("series-pipes");
    expect(isDirty({ diagram, baseline: diagramFingerprint(diagram) })).toBe(false);
  });

  it("is dirty after a name or position edit", () => {
    const diagram = stock("series-pipes");
    const baseline = diagramFingerprint(diagram);
    expect(isDirty({ diagram: { ...diagram, name: `${diagram.name} edited` }, baseline })).toBe(
      true,
    );
    const moved: Diagram = {
      ...diagram,
      nodes: diagram.nodes.map((n, i) => (i === 0 ? { ...n, x: n.x + 12 } : n)),
    };
    expect(isDirty({ diagram: moved, baseline })).toBe(true);
  });

  it("is clean for a stock example when baseline is that diagram", () => {
    const entry = EXAMPLE_CATALOG.find((e) => e.id === "parallel-pipes");
    expect(entry).toBeDefined();
    const diagram = stock(entry!.id);
    expect(isDirty({ diagram, baseline: diagramFingerprint(diagram) })).toBe(false);
  });

  it("stock A→B after a baseline update is not dirty", () => {
    const a = stock("series-pipes");
    const b = stock("parallel-pipes");
    expect(diagramFingerprint(a)).not.toBe(diagramFingerprint(b));
    expect(isDirty({ diagram: a, baseline: diagramFingerprint(a) })).toBe(false);
    const afterLoad = { diagram: b, baseline: diagramFingerprint(b) };
    expect(isDirty(afterLoad)).toBe(false);
  });
});

describe("runReplace", () => {
  it("applies a clean replace without calling confirm", () => {
    const confirm = vi.fn(() => false);
    const apply = vi.fn();
    expect(runReplace({ isDirty: false, confirm, apply })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
  });

  it("does not apply when dirty and confirm cancels", () => {
    const confirm = vi.fn((msg: string) => {
      expect(msg).toBe(DISCARD_MESSAGE);
      return false;
    });
    const apply = vi.fn();
    expect(runReplace({ isDirty: true, confirm, apply })).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();
  });

  it("applies when dirty and confirm accepts", () => {
    const confirm = vi.fn(() => true);
    const apply = vi.fn();
    expect(runReplace({ isDirty: true, confirm, apply })).toBe(true);
    expect(confirm).toHaveBeenCalledWith(DISCARD_MESSAGE);
    expect(apply).toHaveBeenCalledOnce();
  });
});

describe("confirmDiscard", () => {
  it("forwards DISCARD_MESSAGE to the injected confirm", () => {
    const confirm = vi.fn(() => true);
    expect(confirmDiscard(confirm)).toBe(true);
    expect(confirm).toHaveBeenCalledWith(DISCARD_MESSAGE);
  });
});

describe("store baseline", () => {
  it("stays clean across stock A→B loads with no edits", () => {
    useStore.getState().loadExample("series-pipes");
    expect(isDirty(useStore.getState())).toBe(false);
    useStore.getState().loadExample("parallel-pipes");
    expect(isDirty(useStore.getState())).toBe(false);
  });

  it("is dirty after a canvas edit and clean after markSaved", () => {
    useStore.getState().loadExample("series-pipes");
    const node = useStore.getState().diagram.nodes[0];
    const baseline = useStore.getState().baseline;
    useStore.getState().moveNode(node.id, node.x + 40, node.y);
    expect(useStore.getState().baseline).toBe(baseline);
    expect(isDirty(useStore.getState())).toBe(true);
    useStore.getState().markSaved();
    expect(isDirty(useStore.getState())).toBe(false);
  });

  it("does not move baseline when importJson throws", () => {
    useStore.getState().loadExample("series-pipes");
    const before = useStore.getState();
    expect(() => useStore.getState().importJson("{")).toThrow();
    const after = useStore.getState();
    expect(after.baseline).toBe(before.baseline);
    expect(after.diagram).toBe(before.diagram);
    expect(isDirty(after)).toBe(false);
  });
});

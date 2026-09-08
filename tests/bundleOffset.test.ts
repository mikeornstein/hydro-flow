import { describe, expect, it } from "vitest";
import {
  BUNDLE_SPACING_PX,
  bundleSlots,
  offsetAlongChord,
  offsetQuadPath,
} from "../src/diagram/bundleOffset";

describe("bundleSlots", () => {
  it("gives a size-1 slot offset 0", () => {
    expect(bundleSlots([{ id: "a", from: "s", to: "t" }]).get("a")).toEqual({
      index: 0,
      size: 1,
      offset: 0,
    });
  });

  it("centers a two-member bundle at ±spacing/2 in input order", () => {
    const slots = bundleSlots([
      { id: "a", from: "s", to: "t" },
      { id: "b", from: "s", to: "t" },
    ]);
    const a = slots.get("a")!;
    const b = slots.get("b")!;
    expect(a).toEqual({ index: 0, size: 2, offset: -BUNDLE_SPACING_PX / 2 });
    expect(b).toEqual({ index: 1, size: 2, offset: BUNDLE_SPACING_PX / 2 });
    expect(a.offset).toBe(-BUNDLE_SPACING_PX / 2);
    expect(b.offset).toBe(BUNDLE_SPACING_PX / 2);
    expect(a.offset).toBe(-b.offset);
  });

  it("treats opposite directions as distinct singleton bundles", () => {
    const slots = bundleSlots([
      { id: "a", from: "s", to: "t" },
      { id: "c", from: "t", to: "s" },
    ]);
    expect(slots.get("a")).toEqual({ index: 0, size: 1, offset: 0 });
    expect(slots.get("c")).toEqual({ index: 0, size: 1, offset: 0 });
  });
});

describe("offsetAlongChord", () => {
  it("uses the left-hand perpendicular of B−A", () => {
    expect(
      offsetAlongChord({ x: 50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }, 10),
    ).toEqual({ x: 50, y: 10 });
  });

  it("returns the origin when the chord is degenerate", () => {
    expect(
      offsetAlongChord({ x: 3, y: 4 }, { x: 1, y: 1 }, { x: 1, y: 1 }, 20),
    ).toEqual({ x: 3, y: 4 });
  });
});

describe("offsetQuadPath", () => {
  it("puts the label on the offset midpoint", () => {
    const q = offsetQuadPath(0, 0, 100, 0, 10);
    expect(q.labelX).toBe(50);
    expect(q.labelY).toBe(10);
    expect(q.path).toBe("M 0 0 Q 50 10 100 0");
  });
});

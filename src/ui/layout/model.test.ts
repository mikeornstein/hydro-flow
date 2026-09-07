import { describe, expect, it } from "vitest";
import {
  isRailViewport,
  RAIL_MEDIA,
  reduceLayout,
  type LayoutSnapshot,
  type SheetId,
} from "./model";

const rail: LayoutSnapshot = { mode: "rail" };
const closed: LayoutSnapshot = { mode: "sheet", sheet: { status: "closed" } };

function open(id: SheetId): LayoutSnapshot {
  return { mode: "sheet", sheet: { status: "open", id } };
}

const SHEETS: SheetId[] = ["library", "inspector", "results", "project", "confirm-remove"];

describe("isRailViewport", () => {
  it("requires both width and height floors", () => {
    expect(isRailViewport(900, 600)).toBe(true);
    expect(isRailViewport(1440, 900)).toBe(true);
    expect(isRailViewport(899, 600)).toBe(false);
    expect(isRailViewport(900, 599)).toBe(false);
  });

  it("keeps iPhone 17 Pro portrait and landscape on sheets", () => {
    expect(isRailViewport(402, 874)).toBe(false);
    expect(isRailViewport(874, 402)).toBe(false);
  });
});

describe("RAIL_MEDIA", () => {
  it("exports the height-aware query used by matchMedia", () => {
    expect(RAIL_MEDIA).toBe("(min-width: 900px) and (min-height: 600px)");
  });
});

describe("reduceLayout", () => {
  it("crosses from sheet to rail and drops any open sheet", () => {
    expect(reduceLayout(open("results"), { type: "viewport-changed", mode: "rail" })).toEqual(rail);
    expect(reduceLayout(closed, { type: "viewport-changed", mode: "rail" })).toEqual(rail);
  });

  it("crosses from rail to a closed sheet", () => {
    expect(reduceLayout(rail, { type: "viewport-changed", mode: "sheet" })).toEqual(closed);
  });

  it("keeps sheet state when the viewport stays in sheet mode", () => {
    expect(reduceLayout(open("library"), { type: "viewport-changed", mode: "sheet" })).toEqual(
      open("library"),
    );
  });

  it("is a no-op when the viewport stays in rail mode", () => {
    expect(reduceLayout(rail, { type: "viewport-changed", mode: "rail" })).toEqual(rail);
  });

  it("opens a sheet from closed and replaces an already-open id", () => {
    expect(reduceLayout(closed, { type: "open", id: "library" })).toEqual(open("library"));
    expect(reduceLayout(open("library"), { type: "open", id: "inspector" })).toEqual(
      open("inspector"),
    );
  });

  it("treats open of the same id as idempotent", () => {
    for (const id of SHEETS) {
      expect(reduceLayout(open(id), { type: "open", id })).toEqual(open(id));
    }
  });

  it("toggles the same id closed and a different id open", () => {
    expect(reduceLayout(closed, { type: "toggle", id: "results" })).toEqual(open("results"));
    expect(reduceLayout(open("results"), { type: "toggle", id: "results" })).toEqual(closed);
    expect(reduceLayout(open("results"), { type: "toggle", id: "project" })).toEqual(open("project"));
  });

  it("treats close as idempotent", () => {
    expect(reduceLayout(open("confirm-remove"), { type: "close" })).toEqual(closed);
    expect(reduceLayout(closed, { type: "close" })).toEqual(closed);
  });

  it("ignores sheet commands while in rail mode", () => {
    expect(reduceLayout(rail, { type: "open", id: "library" })).toEqual(rail);
    expect(reduceLayout(rail, { type: "toggle", id: "library" })).toEqual(rail);
    expect(reduceLayout(rail, { type: "close" })).toEqual(rail);
  });
});

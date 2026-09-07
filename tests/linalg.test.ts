import { describe, expect, it } from "vitest";
import { solveLinear, matVec } from "../src/engine/linalg";

describe("LU solver", () => {
  it("solves a well-conditioned 2×2", () => {
    const A = [
      [3, 1],
      [1, 2],
    ];
    const b = [9, 8];
    const x = solveLinear(A, b);
    expect(x[0]).toBeCloseTo(2, 10);
    expect(x[1]).toBeCloseTo(3, 10);
  });

  it("solves a diagonally dominant 4×4", () => {
    const A = [
      [10, -1, 0, 0],
      [-1, 10, -1, 0],
      [0, -1, 10, -1],
      [0, 0, -1, 10],
    ];
    const xTrue = [1, 2, 3, 4];
    const b = matVec(A, xTrue);
    const x = solveLinear(A, b);
    x.forEach((xi, i) => expect(xi).toBeCloseTo(xTrue[i], 9));
  });

  it("throws on a singular matrix", () => {
    expect(() =>
      solveLinear(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toThrow(/singular/);
  });
});

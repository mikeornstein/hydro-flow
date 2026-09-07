/** Dense linear solve A x = b via Gaussian elimination with partial pivoting. */
export function solveDense(
  A: number[][],
  b: number[],
): number[] | null {
  const n = b.length;
  if (n === 0) return [];
  // Work on copies.
  const M = A.map((row) => row.slice());
  const x = b.slice();

  for (let col = 0; col < n; col++) {
    // Partial pivot.
    let pivot = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-15) return null; // singular
    if (pivot !== col) {
      [M[col], M[pivot]] = [M[pivot], M[col]];
      [x[col], x[pivot]] = [x[pivot], x[col]];
    }
    const diag = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / diag;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) {
        M[r][c] -= factor * M[col][c];
      }
      x[r] -= factor * x[col];
    }
  }

  // Back substitution.
  for (let r = n - 1; r >= 0; r--) {
    let sum = x[r];
    for (let c = r + 1; c < n; c++) {
      sum -= M[r][c] * x[c];
    }
    x[r] = sum / M[r][r];
  }
  return x;
}

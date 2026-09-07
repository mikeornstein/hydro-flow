/**
 * Dense linear algebra for the network Newton system (N ≲ a few hundred).
 * LU with partial pivoting.
 */

export function solveLinear(Ain: number[][], bin: number[]): number[] {
  const n = bin.length;
  if (n === 0) return [];
  const A = Ain.map((row) => row.slice());
  const b = bin.slice();
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;

  for (let k = 0; k < n; k++) {
    let max = 0;
    let kmax = k;
    for (let i = k; i < n; i++) {
      const v = Math.abs(A[i][k]);
      if (v > max) {
        max = v;
        kmax = i;
      }
    }
    if (max < 1e-18) {
      throw new Error("singular");
    }
    if (kmax !== k) {
      const tmp = A[k];
      A[k] = A[kmax];
      A[kmax] = tmp;
      const tb = b[k];
      b[k] = b[kmax];
      b[kmax] = tb;
    }
    const akk = A[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / akk;
      A[i][k] = f;
      for (let j = k + 1; j < n; j++) {
        A[i][j] -= f * A[k][j];
      }
      b[i] -= f * b[k];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

export function matVec(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));
}

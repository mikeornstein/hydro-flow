#!/usr/bin/env node
// Independent hand calculation for tests/fixtures/goldens.json cases A-D.
// Deliberately shares no code with src/engine: Swamee-Jain friction and
// bisection here, Churchill friction and Newton there. The engine must land
// within tolerance of these numbers, so this file is the acceptance source.
//
//   node scripts/goldens-reference.mjs           print the reference values
//   node scripts/goldens-reference.mjs --write   rewrite the fixture's expected blocks
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDENS_PATH = join(ROOT, "tests/fixtures/goldens.json");
const G = 9.80665;

function loadProject(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

function node(project, id) {
  const n = project.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node ${id} missing`);
  return n;
}

function link(project, id) {
  const l = project.links.find((x) => x.id === id);
  if (!l) throw new Error(`link ${id} missing`);
  return l;
}

function fluidOf(project, ref) {
  return project.fluids[ref.fluid];
}

export function swameeJain(Re, epsOverD) {
  return 0.25 / Math.log10(epsOverD / 3.7 + 5.74 / Re ** 0.9) ** 2;
}

export function frictionFactor(Re, epsOverD) {
  return Re < 2300 ? 64 / Re : swameeJain(Re, epsOverD);
}

export function pipeDrop(project, linkId, Q) {
  const l = link(project, linkId);
  const { L, D, eps } = l.component.geometry;
  const { rho, mu } = fluidOf(project, l);
  const V = Q / ((Math.PI * D * D) / 4);
  const Re = (rho * V * D) / mu;
  const f = frictionFactor(Re, eps / D);
  const dP = ((f * L) / D + l.component.K) * rho * V * V * 0.5;
  return { Q, V, Re, f, dP };
}

/** Pressure available to drive flow from -> to, hydrostatic included. */
function drivingHead(project, fromId, toId) {
  const a = node(project, fromId);
  const b = node(project, toId);
  const rho = fluidOf(project, a).rho;
  return a.pFixed - b.pFixed + rho * G * (a.z - b.z);
}

function polyval(coeffs, x) {
  return coeffs.reduce((sum, c, i) => sum + c * x ** i, 0);
}

export function bisect(fn, lo, hi) {
  let flo = fn(lo);
  if (flo * fn(hi) > 0) throw new Error("bisect: root not bracketed");
  for (let i = 0; i < 200 && hi - lo > 1e-16 * hi; i++) {
    const mid = (lo + hi) / 2;
    const fm = fn(mid);
    if (fm === 0) return mid;
    if (fm < 0 === flo < 0) {
      lo = mid;
      flo = fm;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function assertClose(a, b, what) {
  const err = Math.abs(a - b) / Math.max(Math.abs(b), 1e-15);
  if (err > 1e-9) throw new Error(`${what}: ${a} vs ${b} (rel ${err})`);
}

function sig(x) {
  return Number(x.toPrecision(13));
}

function linkRow({ Q, V, Re, f }) {
  return { Q: sig(Q), V: sig(V), Re: sig(Re), f: sig(f) };
}

function seriesPipes() {
  const p = loadProject("examples/series-pipes.hydroflow.json");
  const head = drivingHead(p, "res-hi", "res-lo");
  const Q = bisect(
    (q) => pipeDrop(p, "pipe-1", q).dP + pipeDrop(p, "pipe-2", q).dP - head,
    1e-12,
    1,
  );
  const a = pipeDrop(p, "pipe-1", Q);
  const b = pipeDrop(p, "pipe-2", Q);
  const hi = node(p, "res-hi");
  const mid = node(p, "mid");
  const lo = node(p, "res-lo");
  const rho = fluidOf(p, hi).rho;
  const pMid = hi.pFixed - a.dP - rho * G * (mid.z - hi.z);
  assertClose(pMid, lo.pFixed + b.dP + rho * G * (lo.z - mid.z), "mid P from both ends");
  return {
    links: { "pipe-1": linkRow(a), "pipe-2": linkRow(b) },
    nodes: { "res-hi": { P: hi.pFixed }, mid: { P: sig(pMid) }, "res-lo": { P: lo.pFixed } },
  };
}

function pumpLoop() {
  const p = loadProject("examples/pump-loop.hydroflow.json");
  const pump = link(p, "pump");
  const rho = fluidOf(p, pump).rho;
  const head = drivingHead(p, "sump", "discharge");
  const H = (q) => polyval(pump.component.pump.coeffs, q);
  const Q = bisect(
    (q) => pipeDrop(p, "pump", q).dP + pipeDrop(p, "pipe", q).dP - head - rho * G * H(q),
    1e-12,
    1,
  );
  return {
    links: {
      pipe: linkRow(pipeDrop(p, "pipe", Q)),
      pump: { Q: sig(Q), H: sig(H(Q)) },
    },
  };
}

function parallelPipes() {
  const p = loadProject("examples/parallel-pipes.hydroflow.json");
  const head = drivingHead(p, "res-hi", "res-lo");
  const links = {};
  let total = 0;
  for (const id of ["pipe-a", "pipe-b"]) {
    const Q = bisect((q) => pipeDrop(p, id, q).dP - head, 1e-12, 1);
    links[id] = linkRow(pipeDrop(p, id, Q));
    total += Q;
  }
  return { links, totals: { Q: sig(total) } };
}

function emitter() {
  const p = loadProject("examples/emitter.hydroflow.json");
  const { k, x } = link(p, "emitter").component.emitter;
  assertClose(k, 2.0e-3 / 3600 / (100e3) ** 0.5, "emitter k vs 2.0 L/h at 100 kPa, x=0.5");
  const dP = drivingHead(p, "supply", "air");
  assertClose(dP, 150e3, "emitter example feeds 150 kPa gauge");
  const Q = k * dP ** x;
  return {
    calibration: "2.0 L/h at 100 kPa, x=0.5",
    k_SI: sig(k),
    Q_m3s_at_150kPa: sig(Q),
    Q_Lph_at_150kPa: sig(Q * 3600e3),
    links: { emitter: { Q: sig(Q) } },
  };
}

export function referenceGoldens() {
  return {
    "A-series-pipes": seriesPipes(),
    "B-pump-loop": pumpLoop(),
    "C-parallel-pipes": parallelPipes(),
    "D-emitter": emitter(),
  };
}

/** Paths where numeric leaves differ beyond tol, or exist on one side only. */
export function numericDiffs(reference, actual, tol, path = "") {
  const diffs = [];
  const keys = new Set([...Object.keys(reference ?? {}), ...Object.keys(actual ?? {})]);
  for (const key of keys) {
    const here = path ? `${path}.${key}` : key;
    const r = reference?.[key];
    const a = actual?.[key];
    if (typeof r === "string" || typeof a === "string") continue;
    if (typeof r === "number" || typeof a === "number") {
      if (typeof r !== "number") diffs.push(`${here} has no reference value`);
      else if (typeof a !== "number") diffs.push(`${here} missing (reference ${r})`);
      else if (Math.abs(r - a) / Math.max(Math.abs(r), 1e-15) > tol) diffs.push(`${here} ${a} != ${r}`);
      continue;
    }
    if (r !== undefined && a !== undefined) diffs.push(...numericDiffs(r, a, tol, here));
    else if (r !== undefined || a !== undefined) diffs.push(`${here} present on one side only`);
  }
  return diffs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reference = referenceGoldens();
  if (process.argv.includes("--write")) {
    const goldens = JSON.parse(readFileSync(GOLDENS_PATH, "utf8"));
    for (const c of goldens.cases) {
      if (reference[c.id]) c.expected = reference[c.id];
    }
    writeFileSync(GOLDENS_PATH, `${JSON.stringify(goldens, null, 2)}\n`);
    console.log(`wrote ${GOLDENS_PATH}`);
  } else {
    console.log(JSON.stringify(reference, null, 2));
  }
}

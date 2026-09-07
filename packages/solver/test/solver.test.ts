import { describe, it, expect } from "vitest";
import { solveSteady, FLUIDS, G, type Project } from "../src/index.js";

const water = FLUIDS.water;

/** Independent Colebrook–White friction factor (implicit, iterated). */
function colebrook(re: number, relRough: number): number {
  if (re < 2000) return 64 / re;
  let f = 0.02;
  for (let i = 0; i < 100; i++) {
    const rhs = -2 * Math.log10(relRough / 3.7 + 2.51 / (re * Math.sqrt(f)));
    const fNew = 1 / (rhs * rhs);
    if (Math.abs(fNew - f) < 1e-12) return fNew;
    f = fNew;
  }
  return f;
}

/** Reference Darcy–Weisbach pressure drop for a pipe carrying flow Q. */
function darcyDP(q: number, L: number, D: number, eps: number): number {
  const area = (Math.PI * D * D) / 4;
  const v = q / area;
  const re = (water.rho * Math.abs(v) * D) / water.mu;
  const f = colebrook(re, eps / D);
  return f * (L / D) * (water.rho / 2) * v * Math.abs(v);
}

function pipeLink(id: string, from: string, to: string, L: number, D: number, eps = 4.6e-5) {
  return { id, from, to, component: { type: "pipe" as const, lossModel: "darcy-weisbach" as const, geometry: { L, D, eps } } };
}

const baseAnalysis = {
  type: "steady" as const,
  flowRegime: "incompressible" as const,
  gravity: true,
  convergence: { massResidual: 1e-10, maxIter: 200, relaxationP: 1 },
};

describe("single pipe — laminar (Hagen–Poiseuille)", () => {
  it("matches the closed-form laminar discharge within 0.5%", () => {
    const L = 10;
    const D = 0.01;
    const dP = 100; // Pa
    const project: Project = {
      fluid: water,
      analysis: baseAnalysis,
      nodes: [
        { id: "a", kind: "boundary", pFixed: 101325 + dP, z: 0 },
        { id: "b", kind: "boundary", pFixed: 101325, z: 0 },
      ],
      links: [pipeLink("p", "a", "b", L, D, 0)],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    const expected = (dP * Math.PI * Math.pow(D, 4)) / (128 * water.mu * L);
    expect(r.links.p.Q).toBeCloseTo(expected, 10);
    expect(relErr(r.links.p.Q, expected)).toBeLessThan(0.005);
    expect(r.links.p.Re).toBeLessThan(2000);
  });
});

describe("single pipe — turbulent (Darcy/Colebrook)", () => {
  it("recovered flow reproduces the reference Darcy drop within 1%", () => {
    const L = 100;
    const D = 0.1;
    const eps = 4.6e-5;
    const dP = 50000; // Pa
    const project: Project = {
      fluid: water,
      analysis: baseAnalysis,
      nodes: [
        { id: "a", kind: "boundary", pFixed: 101325 + dP, z: 0 },
        { id: "b", kind: "boundary", pFixed: 101325, z: 0 },
      ],
      links: [pipeLink("p", "a", "b", L, D, eps)],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.links.p.Re).toBeGreaterThan(4000);
    const dpRef = darcyDP(r.links.p.Q, L, D, eps);
    expect(relErr(dpRef, dP)).toBeLessThan(0.01);
  });
});

describe("two pipes in series", () => {
  it("conserves flow and sums head losses", () => {
    const project: Project = {
      fluid: water,
      analysis: baseAnalysis,
      nodes: [
        { id: "a", kind: "boundary", pFixed: 250000, z: 0 },
        { id: "b", kind: "junction", z: 0 },
        { id: "c", kind: "boundary", pFixed: 101325, z: 0 },
      ],
      links: [pipeLink("p1", "a", "b", 60, 0.08), pipeLink("p2", "b", "c", 80, 0.06)],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(relErr(r.links.p1.Q, r.links.p2.Q)).toBeLessThan(1e-6);
    const totalDrop = r.nodes.a.P - r.nodes.c.P;
    expect(relErr(r.links.p1.dP + r.links.p2.dP, totalDrop)).toBeLessThan(1e-6);
  });
});

describe("two pipes in parallel", () => {
  it("splits flow evenly between identical branches", () => {
    const project: Project = {
      fluid: water,
      analysis: baseAnalysis,
      nodes: [
        { id: "a", kind: "boundary", pFixed: 200000, z: 0 },
        { id: "b", kind: "boundary", pFixed: 101325, z: 0 },
      ],
      links: [pipeLink("p1", "a", "b", 100, 0.05), pipeLink("p2", "a", "b", 100, 0.05)],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(relErr(r.links.p1.Q, r.links.p2.Q)).toBeLessThan(1e-6);
  });
});

describe("elevation only (hydrostatic, no flow)", () => {
  it("dead-end pressure equals hydrostatic head", () => {
    const z = 10;
    const project: Project = {
      fluid: water,
      analysis: baseAnalysis,
      nodes: [
        { id: "tank", kind: "boundary", pFixed: 101325, z },
        { id: "dead", kind: "junction", z: 0 },
      ],
      links: [pipeLink("riser", "tank", "dead", 20, 0.05)],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(Math.abs(r.links.riser.Q)).toBeLessThan(1e-9);
    const expected = 101325 + water.rho * G * z;
    expect(relErr(r.nodes.dead.P, expected)).toBeLessThan(1e-6);
  });
});

describe("three-node loop (Kirchhoff continuity)", () => {
  it("satisfies nodal mass balance at every junction", () => {
    const project: Project = {
      fluid: water,
      analysis: baseAnalysis,
      nodes: [
        { id: "src", kind: "boundary", pFixed: 300000, z: 0 },
        { id: "b", kind: "junction", z: 0 },
        { id: "c", kind: "junction", z: 0 },
        { id: "sink", kind: "boundary", pFixed: 101325, z: 0 },
      ],
      links: [
        pipeLink("l_sb", "src", "b", 50, 0.08),
        pipeLink("l_sc", "src", "c", 50, 0.08),
        pipeLink("l_bc", "b", "c", 40, 0.05),
        pipeLink("l_bk", "b", "sink", 60, 0.06),
        pipeLink("l_ck", "c", "sink", 60, 0.06),
      ],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    // Continuity at b: in from src = out to c + out to sink.
    const b = r.links.l_sb.Q - r.links.l_bc.Q - r.links.l_bk.Q;
    const c = r.links.l_sc.Q + r.links.l_bc.Q - r.links.l_ck.Q;
    expect(Math.abs(b)).toBeLessThan(1e-9);
    expect(Math.abs(c)).toBeLessThan(1e-9);
  });
});

describe("P0 acceptance — pump lifting between two reservoirs", () => {
  it("operating point matches an independent system-curve solve within 1%", () => {
    const L = 80;
    const D = 0.1;
    const eps = 4.6e-5;
    const dz = 12; // lift, m
    const pump = { a: 300000, c: -2.0e8 }; // Hp = 300 kPa - 2e8 Q^2
    const project: Project = {
      fluid: water,
      analysis: baseAnalysis,
      nodes: [
        { id: "lower", kind: "boundary", pFixed: 101325, z: 0 },
        { id: "upper", kind: "boundary", pFixed: 101325, z: dz },
      ],
      links: [
        {
          id: "pumpline",
          from: "lower",
          to: "upper",
          component: { type: "pump", lossModel: "darcy-weisbach", geometry: { L, D, eps }, pump },
        },
      ],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");

    // Independent solve: pump rise = static lift + friction(Q).
    const staticLift = water.rho * G * dz;
    const f = (q: number) => pump.a + pump.c * q * q - (staticLift + darcyDP(q, L, D, eps));
    // Bisection on Q.
    let lo = 0;
    let hi = 0.2;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid;
      else hi = mid;
    }
    const qRef = (lo + hi) / 2;
    expect(relErr(r.links.pumpline.Q, qRef)).toBeLessThan(0.01);
    expect(r.links.pumpline.Q).toBeGreaterThan(0);
  });
});

function relErr(a: number, b: number): number {
  const denom = Math.max(Math.abs(b), 1e-12);
  return Math.abs(a - b) / denom;
}

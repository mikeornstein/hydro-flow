import { describe, expect, it } from "vitest";
import { solveSteady } from "../src/engine/solve";
import { WATER } from "../src/engine/fluids";
import { darcyWeisbach, hagenPoiseuille } from "../src/engine/friction";
import { G, P_ATM, type Project } from "../src/engine/types";
import { verifySolution } from "../src/engine/verify";

const conv = {
  massResidual: 1e-10,
  energyResidual: 1e-8,
  maxIter: 80,
  relaxationP: 0.85,
  relaxationQ: 0.7,
};

function baseProject(over: Partial<Project>): Project {
  return {
    version: "0.1.0",
    meta: {
      name: "t",
      description: "",
      createdAt: "2026-09-07T00:00:00Z",
      updatedAt: "2026-09-07T00:00:00Z",
    },
    units: {
      system: "SI",
      length: "m",
      pressure: "Pa",
      flow: "m3/s",
      temperature: "K",
      power: "W",
    },
    fluids: { water: WATER },
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy: false,
      gravity: true,
      convergence: conv,
    },
    nodes: [],
    links: [],
    couplings: [],
    ...over,
  };
}

describe("hydraulics", () => {
  it("laminar single pipe matches Hagen–Poiseuille", () => {
    const D = 0.04;
    const L = 12;
    const Re = 800;
    const V = (Re * WATER.mu) / (WATER.rho * D);
    const Q = V * 0.25 * Math.PI * D * D;
    const dp = hagenPoiseuille(Q, L, D, WATER.mu);
    const p1 = P_ATM + dp;
    const project = baseProject({
      nodes: [
        {
          id: "a",
          kind: "boundary",
          x: 0,
          y: 0,
          z: 0,
          fluid: "water",
          pFixed: p1,
        },
        {
          id: "b",
          kind: "boundary",
          x: 1,
          y: 0,
          z: 0,
          fluid: "water",
          pFixed: P_ATM,
        },
      ],
      links: [
        {
          id: "p",
          from: "a",
          to: "b",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L, D, eps: 0 },
            K: 0,
          },
        },
      ],
    });
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.links.p.Q).toBeCloseTo(Q, 7);
  });

  it("two equal pipes in parallel split flow evenly", () => {
    const D = 0.03;
    const L = 8;
    const project = baseProject({
      nodes: [
        { id: "a", kind: "boundary", x: 0, y: 0, z: 0, fluid: "water", pFixed: P_ATM + 8000 },
        { id: "j1", kind: "junction", x: 1, y: 0, z: 0, fluid: "water" },
        { id: "j2", kind: "junction", x: 2, y: 0, z: 0, fluid: "water" },
        { id: "b", kind: "boundary", x: 3, y: 0, z: 0, fluid: "water", pFixed: P_ATM },
      ],
      links: [
        {
          id: "in",
          from: "a",
          to: "j1",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 1, D: 0.05, eps: 0 },
            K: 0,
          },
        },
        {
          id: "p1",
          from: "j1",
          to: "j2",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L, D, eps: 0 },
            K: 0,
          },
        },
        {
          id: "p2",
          from: "j1",
          to: "j2",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L, D, eps: 0 },
            K: 0,
          },
        },
        {
          id: "out",
          from: "j2",
          to: "b",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 1, D: 0.05, eps: 0 },
            K: 0,
          },
        },
      ],
    });
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.links.p1.Q).toBeCloseTo(r.links.p2.Q, 9);
    expect(r.links.in.Q).toBeCloseTo(r.links.p1.Q + r.links.p2.Q, 9);
    const v = verifySolution(project, r);
    expect(v.pass).toBe(true);
  });

  it("series pipes: Δp sums, Q is unique", () => {
    const project = baseProject({
      nodes: [
        { id: "a", kind: "boundary", x: 0, y: 0, z: 0, fluid: "water", pFixed: P_ATM + 15000 },
        { id: "m", kind: "junction", x: 1, y: 0, z: 0, fluid: "water" },
        { id: "b", kind: "boundary", x: 2, y: 0, z: 0, fluid: "water", pFixed: P_ATM },
      ],
      links: [
        {
          id: "p1",
          from: "a",
          to: "m",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 5, D: 0.03, eps: 4.6e-5 },
            K: 0,
          },
        },
        {
          id: "p2",
          from: "m",
          to: "b",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 7, D: 0.025, eps: 4.6e-5 },
            K: 1.5,
          },
        },
      ],
    });
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.links.p1.Q).toBeCloseTo(r.links.p2.Q, 10);
    const dp1 = darcyWeisbach({
      Q: r.links.p1.Q,
      L: 5,
      D: 0.03,
      eps: 4.6e-5,
      rho: WATER.rho,
      mu: WATER.mu,
      K: 0,
    }).dp;
    const dp2 = darcyWeisbach({
      Q: r.links.p2.Q,
      L: 7,
      D: 0.025,
      eps: 4.6e-5,
      rho: WATER.rho,
      mu: WATER.mu,
      K: 1.5,
    }).dp;
    expect(r.nodes.a.P - r.nodes.b.P).toBeCloseTo(dp1 + dp2, 2);
  });

  it("hydrostatic: elevation only, Q = 0", () => {
    const z = 8;
    const project = baseProject({
      nodes: [
        { id: "a", kind: "boundary", x: 0, y: 0, z: 0, fluid: "water", pFixed: P_ATM },
        { id: "b", kind: "junction", x: 0, y: 0, z, fluid: "water" },
      ],
      links: [
        {
          id: "p",
          from: "a",
          to: "b",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: z, D: 0.05, eps: 0 },
            K: 0,
          },
        },
      ],
    });
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(Math.abs(r.links.p.Q)).toBeLessThan(1e-8);
    expect(r.nodes.a.P - r.nodes.b.P).toBeCloseTo(WATER.rho * G * z, 1);
  });

  it("pump + system curve intersection", () => {
    // H = 15 − 2e7 Q²  (m). System is a K-only pipe, D=0.03, K=20, L=0, no elevation.
    const coeffs = [15, 0, -2e7];
    const D = 0.03;
    const K = 20;
    const project = baseProject({
      analysis: {
        type: "steady",
        flowRegime: "incompressible",
        energy: false,
        gravity: false,
        convergence: conv,
      },
      nodes: [
        { id: "s", kind: "boundary", x: 0, y: 0, z: 0, fluid: "water", pFixed: P_ATM },
        { id: "d", kind: "boundary", x: 1, y: 0, z: 0, fluid: "water", pFixed: P_ATM },
      ],
      links: [
        {
          id: "pump",
          from: "s",
          to: "m",
          fluid: "water",
          component: {
            type: "pump",
            lossModel: "darcy-weisbach",
            geometry: { L: 0, D, eps: 0 },
            K: 0,
            pump: { coeffs },
          },
        },
        {
          id: "sys",
          from: "m",
          to: "d",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 0, D, eps: 0 },
            K,
          },
        },
      ],
    });
    // forgot junction m — add it
    project.nodes.splice(1, 0, {
      id: "m",
      kind: "junction",
      x: 0.5,
      y: 0,
      z: 0,
      fluid: "water",
    });
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    const Q = r.links.pump.Q;
    const H = coeffs[0] + coeffs[2] * Q * Q;
    const A = 0.25 * Math.PI * D * D;
    const V = Q / A;
    const dpSys = K * WATER.rho * V * Math.abs(V) * 0.5;
    const dpPump = WATER.rho * G * H;
    expect(dpPump).toBeCloseTo(dpSys, 0);
    expect(Q).toBeGreaterThan(0);
  });

  it("three-node loop: Kirchhoff current and voltage", () => {
    const project = baseProject({
      nodes: [
        { id: "n1", kind: "boundary", x: 0, y: 0, z: 0, fluid: "water", pFixed: P_ATM + 20000 },
        { id: "n2", kind: "junction", x: 1, y: 0, z: 0, fluid: "water" },
        { id: "n3", kind: "junction", x: 0.5, y: 1, z: 0, fluid: "water" },
      ],
      links: [
        {
          id: "a",
          from: "n1",
          to: "n2",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 4, D: 0.025, eps: 0 },
            K: 0,
          },
        },
        {
          id: "b",
          from: "n2",
          to: "n3",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 3, D: 0.02, eps: 0 },
            K: 2,
          },
        },
        {
          id: "c",
          from: "n3",
          to: "n1",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 5, D: 0.022, eps: 0 },
            K: 1,
          },
        },
      ],
    });
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    // n2: Qin a = Qout b
    expect(r.links.a.Q).toBeCloseTo(r.links.b.Q, 9);
    // n3: Qin b = Qout c
    expect(r.links.b.Q).toBeCloseTo(r.links.c.Q, 9);
    // loop: sum Δp around n2-n3-n1 using constitutive equals 0 in the sense
    // P2-P3 = dP_b, P3-P1 = dP_c, P1-P2 = dP_a → sum dP = 0
    const sum =
      r.links.a.dP + r.links.b.dP + r.links.c.dP;
    expect(Math.abs(sum)).toBeLessThan(0.05);
  });
});

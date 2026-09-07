import { describe, expect, it } from "vitest";
import { solveSteady } from "../src/engine/solve";
import { WATER } from "../src/engine/fluids";
import { linkDeltaP } from "../src/engine/constitutive";
import { areaFromD, darcyWeisbach, hagenPoiseuille } from "../src/engine/friction";
import { G, P_ATM, type LinkDef, type NodeDef, type Project } from "../src/engine/types";
import { verifySolution } from "../src/engine/verify";
import seriesPipes from "../examples/series-pipes.hydroflow.json";

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

function swameeJain(Re: number, epsOverD: number): number {
  return 0.25 / Math.log10(epsOverD / 3.7 + 5.74 / Re ** 0.9) ** 2;
}

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

  it("U2 turbulent Δp agrees with an independent Swamee–Jain evaluation", () => {
    const L = 50;
    const D = 0.05;
    const eps = 4.5e-5;
    const K = 0.5;
    const Q = 3.471278803556e-3;
    const dw = darcyWeisbach({ Q, L, D, eps, rho: WATER.rho, mu: WATER.mu, K });
    const V = Q / areaFromD(D);
    const Re = (WATER.rho * V * D) / WATER.mu;
    const independent = ((swameeJain(Re, eps / D) * L) / D + K) * WATER.rho * V * V * 0.5;
    expect(Re).toBeGreaterThan(2300);
    expect(relErr(dw.dp, independent)).toBeLessThan(5e-3);
    expect(relErr(dw.f, swameeJain(Re, eps / D))).toBeLessThan(5e-3);
  });

  it("U3 minor loss only: Δp = K ρ V² / 2 with the sign of Q", () => {
    const D = 0.05;
    const K = 1.5;
    const nodes: Record<string, NodeDef> = {
      a: { id: "a", kind: "junction", x: 0, y: 0, z: 0, fluid: "water" },
      b: { id: "b", kind: "junction", x: 1, y: 0, z: 0, fluid: "water" },
    };
    const link: LinkDef = {
      id: "k",
      from: "a",
      to: "b",
      fluid: "water",
      component: { type: "valve", lossModel: "k-factor", geometry: { L: 0, D, eps: 0 }, K },
    };
    for (const Q of [2e-3, -2e-3]) {
      const V = Q / areaFromD(D);
      const expected = K * WATER.rho * V * Math.abs(V) * 0.5;
      const ev = linkDeltaP(link, Q, WATER, nodes, true);
      expect(relErr(ev.dP, expected)).toBeLessThan(1e-12);
      expect(ev.f).toBeUndefined();
    }
  });

  it("U4 hydrostatic only: 15 m of water is 146834.97045 Pa, applied once", () => {
    const nodes: Record<string, NodeDef> = {
      lo: { id: "lo", kind: "junction", x: 0, y: 0, z: 0, fluid: "water" },
      hi: { id: "hi", kind: "junction", x: 0, y: 0, z: 15, fluid: "water" },
    };
    const link: LinkDef = {
      id: "riser",
      from: "lo",
      to: "hi",
      fluid: "water",
      component: { type: "pipe", lossModel: "darcy-weisbach", geometry: { L: 15, D: 0.05, eps: 0 }, K: 0 },
    };
    expect(relErr(linkDeltaP(link, 0, WATER, nodes, true).dP, 146834.97045)).toBeLessThan(1e-9);
    expect(linkDeltaP(link, 0, WATER, nodes, false).dP).toBe(0);
  });

  it("15 m lift encoded three ways gives one Q (Golden A topology)", () => {
    const base = seriesPipes as unknown as Project;
    const rho = base.fluids["water-20C"].rho;
    const nodeZ = Object.fromEntries(base.nodes.map((n) => [n.id, n.z]));

    const inPressure = structuredClone(base);
    inPressure.analysis.gravity = false;
    for (const n of inPressure.nodes) {
      if (n.pFixed !== undefined) n.pFixed += rho * G * n.z;
    }

    const onLinks = structuredClone(base);
    for (const n of onLinks.nodes) n.z = 0;
    for (const l of onLinks.links) l.component.geometry.dZ = nodeZ[l.to] - nodeZ[l.from];

    const [fromNodes, fromPressure, fromLinks] = [base, inPressure, onLinks].map((p) => {
      const r = solveSteady(p);
      expect(r.status).toBe("converged");
      expect(verifySolution(p, r).pass).toBe(true);
      return r;
    });
    const Q = fromNodes.links["pipe-1"].Q;
    const doubleCounted = "a double-counted 15 m head would move Q by 41%";
    expect(relErr(fromPressure.links["pipe-1"].Q, Q), doubleCounted).toBeLessThan(1e-6);
    expect(relErr(fromLinks.links["pipe-1"].Q, Q), doubleCounted).toBeLessThan(1e-6);
    expect(relErr(Q, 3.471278803556e-3)).toBeLessThan(1e-2);

    const datumShift = fromPressure.nodes.mid.P - fromNodes.nodes.mid.P;
    expect(relErr(datumShift, rho * G * nodeZ.mid)).toBeLessThan(1e-6);
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

import { describe, expect, it } from "vitest";
import { pipeDrop } from "../scripts/goldens-reference.mjs";
import { solveSteady } from "../src/engine/solve";
import { polyval } from "../src/engine/thermo";
import { G, type Project } from "../src/engine/types";
import parallelPipes from "../examples/parallel-pipes.hydroflow.json";
import seriesPipes from "../examples/series-pipes.hydroflow.json";
import pumpLoop from "../examples/pump-loop.hydroflow.json";
import emitterProject from "../examples/emitter.hydroflow.json";
import dlcProject from "../examples/dlc-pumped-cooling.hydroflow.json";

const examples: Project[] = [
  parallelPipes as Project,
  seriesPipes as Project,
  pumpLoop as Project,
  emitterProject as Project,
  dlcProject as Project,
];

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-15);
}

/** What ResultsDock prints for the Loss column. */
function lossCellKPa(lossPa: number): string {
  return (lossPa / 1000).toFixed(2);
}

describe("LinkResult constitutive parts", () => {
  it("identity dP = loss + elev − rise on every link of the P0 examples", () => {
    for (const project of examples) {
      const r = solveSteady(project);
      expect(r.status).toBe("converged");
      for (const link of project.links) {
        const lr = r.links[link.id];
        expect(lr.dP, link.id).toBeCloseTo(lr.loss + lr.elev - lr.rise, 9);
      }
    }
  });

  it("Golden C: loss matches independent friction drop; table cell is not -0.00", () => {
    const project = parallelPipes as Project;
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    for (const id of ["pipe-a", "pipe-b"] as const) {
      const a = r.links[id];
      const ref = pipeDrop(project, id, a.Q);
      expect(relErr(a.loss, ref.dP), `${id} loss vs pipeDrop`).toBeLessThan(0.01);
      expect(a.elev).toBeCloseTo(-998.2 * G * 15, 3);
      expect(a.rise).toBe(0);
      expect(Math.abs(a.dP)).toBeLessThan(0.05);
      const cell = lossCellKPa(a.loss);
      expect(cell).not.toBe("-0.00");
      expect(cell).not.toBe("0.00");
      expect(Number(cell)).toBeGreaterThan(100);
    }
  });

  it("Golden A: branch losses sum to the 15 m driving head", () => {
    const project = seriesPipes as Project;
    const r = solveSteady(project);
    const head = 998.2 * G * 15;
    const sum = r.links["pipe-1"].loss + r.links["pipe-2"].loss;
    expect(relErr(sum, head)).toBeLessThan(0.01);
    for (const id of ["pipe-1", "pipe-2"] as const) {
      const ref = pipeDrop(project, id, r.links[id].Q);
      expect(relErr(r.links[id].loss, ref.dP), id).toBeLessThan(0.01);
    }
  });

  it("Golden B: pump.rise is ρ g H(Q) and balances the pipe loss+elev", () => {
    const project = pumpLoop as Project;
    const r = solveSteady(project);
    const pump = r.links.pump;
    const pipe = r.links.pipe;
    const rho = project.fluids[project.links.find((l) => l.id === "pump")!.fluid].rho;
    const coeffs = project.links.find((l) => l.id === "pump")!.component.pump!.coeffs;
    const H = polyval(coeffs, pump.Q);
    expect(relErr(pump.rise, rho * G * H)).toBeLessThan(1e-9);
    expect(pump.loss).toBe(0);
    expect(pump.elev).toBe(0);
    expect(relErr(pipe.loss + pipe.elev, pump.rise)).toBeLessThan(1e-6);
  });

  it("tee side leg folds junction drop into loss so loss === dP when elev and rise are 0", () => {
    const rho = 998.2;
    const Dc = 0.02;
    const Ds = 0.01;
    const Qc = 1e-3;
    const q = 0.3;
    const project: Project = {
      version: "0.1.0",
      meta: { name: "tee-parts", createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z" },
      units: {
        system: "SI",
        length: "m",
        pressure: "Pa",
        flow: "m3/s",
        temperature: "K",
        power: "W",
      },
      fluids: {
        water: {
          id: "water",
          name: "water",
          phase: "liquid",
          rho,
          mu: 0.001,
          cp: 4182,
          k: 0.6,
          beta: 2e-4,
          Tref: 293.15,
        },
      },
      analysis: {
        type: "steady",
        flowRegime: "incompressible",
        energy: false,
        gravity: false,
        convergence: {
          massResidual: 1e-10,
          energyResidual: 1e-8,
          maxIter: 80,
          relaxationP: 0.85,
          relaxationQ: 0.7,
        },
      },
      nodes: [
        { id: "in", kind: "boundary", x: 0, y: 0, z: 0, fluid: "water", pFixed: 2e5 },
        { id: "J", kind: "junction", x: 1, y: 0, z: 0, fluid: "water", tee: { branch: "side" } },
        { id: "R", kind: "junction", x: 2, y: 0, z: 0, fluid: "water", mdotSource: -rho * Qc * (1 - q) },
        { id: "S", kind: "junction", x: 2, y: 1, z: 0, fluid: "water", mdotSource: -rho * Qc * q },
      ],
      links: [
        {
          id: "main",
          from: "in",
          to: "J",
          fluid: "water",
          component: { type: "pipe", lossModel: "darcy-weisbach", geometry: { L: 0, D: Dc, eps: 0 }, K: 0 },
        },
        {
          id: "run",
          from: "J",
          to: "R",
          fluid: "water",
          component: { type: "pipe", lossModel: "darcy-weisbach", geometry: { L: 0, D: Dc, eps: 0 }, K: 0 },
        },
        {
          id: "side",
          from: "J",
          to: "S",
          fluid: "water",
          component: { type: "pipe", lossModel: "darcy-weisbach", geometry: { L: 0, D: Ds, eps: 0 }, K: 0 },
        },
      ],
      couplings: [],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.links.side.elev).toBe(0);
    expect(r.links.side.rise).toBe(0);
    expect(r.links.side.loss).toBeCloseTo(r.links.side.dP, 9);
    expect(Math.abs(r.links.side.loss)).toBeGreaterThan(1);
  });
});

import { describe, expect, it } from "vitest";
import { WATER } from "../src/engine/fluids";
import { energyBalance, solveSteady } from "../src/engine/solve";
import { P_ATM, type Fluid, type LinkDef, type Project } from "../src/engine/types";
import { verifySolution } from "../src/engine/verify";

const LOAD_W = 1500;
const COLD: Fluid = { ...WATER, id: "loop-cold", name: "Cold loop" };

function link(
  id: string,
  from: string,
  to: string,
  fluid: string,
  component: LinkDef["component"],
): LinkDef {
  return { id, from, to, fluid, component };
}

function dw(
  type: LinkDef["component"]["type"],
  extra: Partial<Omit<LinkDef["component"], "type" | "lossModel">> = {},
): LinkDef["component"] {
  const { geometry, K = 1, ...rest } = extra;
  return {
    type,
    lossModel: "darcy-weisbach",
    geometry: { L: 1, D: 0.02, eps: 0, ...geometry },
    K,
    ...rest,
  };
}

function closedHexRadiator(): Project {
  return {
    version: "0.1.0",
    meta: {
      name: "Closed HEX + radiator",
      description: "IFHX between two closed loops; radiator is the only ambient sink.",
      createdAt: "2026-09-12T00:00:00Z",
      updatedAt: "2026-09-12T00:00:00Z",
    },
    units: {
      system: "SI",
      length: "m",
      pressure: "Pa",
      flow: "m3/s",
      temperature: "K",
      power: "W",
    },
    fluids: { [WATER.id]: WATER, [COLD.id]: COLD },
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy: true,
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
      { id: "htank", kind: "tank", x: 0, y: 0, z: 0, fluid: WATER.id, pFixed: P_ATM + 50000 },
      { id: "h1", kind: "junction", x: 80, y: 0, z: 0, fluid: WATER.id },
      { id: "h2", kind: "junction", x: 160, y: 0, z: 0, fluid: WATER.id },
      { id: "ctank", kind: "tank", x: 0, y: 80, z: 0, fluid: COLD.id, pFixed: P_ATM + 50000 },
      { id: "c1", kind: "junction", x: 80, y: 80, z: 0, fluid: COLD.id },
      { id: "c2", kind: "junction", x: 160, y: 80, z: 0, fluid: COLD.id },
    ],
    links: [
      link(
        "hpump",
        "htank",
        "h1",
        WATER.id,
        dw("pump", { geometry: { L: 0, D: 0.02, eps: 0 }, K: 1.2, pump: { coeffs: [5, 0, -5e8], hMin: 0 } }),
      ),
      link("hload", "h1", "h2", WATER.id, dw("cold-plate", { q: LOAD_W })),
      link("hhex", "h2", "htank", WATER.id, dw("hex-stream", { K: 6 })),
      link(
        "cpump",
        "ctank",
        "c1",
        COLD.id,
        dw("pump", { geometry: { L: 0, D: 0.02, eps: 0 }, K: 1.2, pump: { coeffs: [5, 0, -5e8], hMin: 0 } }),
      ),
      link("chex", "c1", "c2", COLD.id, dw("hex-stream", { K: 6 })),
      link(
        "crad",
        "c2",
        "ctank",
        COLD.id,
        dw("radiator", { radiator: { ua: 180, tSink: 288.15 } }),
      ),
    ],
    couplings: [
      {
        id: "ifhx",
        type: "hex",
        hotLinkId: "hhex",
        coldLinkId: "chex",
        ua: 400,
        arrangement: "counterflow",
      },
    ],
  };
}

describe("closed-loop HEX plus radiator", () => {
  const project = closedHexRadiator();
  const result = solveSteady(project);
  const report = verifySolution(project, result);
  const bal = energyBalance(project, result.links, result.couplings);

  it("converges with no energy-mismatch warning", () => {
    expect(result.status).toBe("converged");
    expect(result.warnings.filter((w) => w.startsWith("Energy mismatch"))).toEqual([]);
  });

  it("counts only the radiator as the ambient sink", () => {
    expect(bal.sources).toBe(LOAD_W);
    expect(bal.hex).toBe(0);
    expect(bal.radiators).toBeGreaterThan(LOAD_W * 0.98);
    expect(Math.abs(bal.sinks - LOAD_W) / LOAD_W).toBeLessThan(0.002);
    expect(Math.abs(-result.links.crad.q! - LOAD_W) / LOAD_W).toBeLessThan(0.002);
    expect(Math.abs(result.couplings.ifhx.q - LOAD_W) / LOAD_W).toBeLessThan(0.002);
  });

  it("passes energy-global", () => {
    const failed = report.checks.filter((c) => !c.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);
  });
});

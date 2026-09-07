import { describe, expect, it } from "vitest";
import { solveSteady } from "../src/engine/solve";
import { WATER } from "../src/engine/fluids";
import { P_ATM, type Project } from "../src/engine/types";
import { hexHeat } from "../src/engine/thermo";
import { AIR_25C } from "../src/engine/fluids";

const conv = {
  massResidual: 1e-10,
  energyResidual: 1e-9,
  maxIter: 80,
  relaxationP: 0.85,
  relaxationQ: 0.7,
};

describe("energy", () => {
  it("prescribed heat into a known ṁ raises ΔT = q/(ṁ cp)", () => {
    const q = 4182;
    const project: Project = {
      version: "0.1.0",
      meta: {
        name: "heat",
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
        energy: true,
        gravity: false,
        convergence: conv,
      },
      nodes: [
        {
          id: "in",
          kind: "boundary",
          x: 0,
          y: 0,
          z: 0,
          fluid: "water",
          pFixed: P_ATM + 5000,
          tFixed: 300,
        },
        { id: "mid", kind: "junction", x: 1, y: 0, z: 0, fluid: "water" },
        {
          id: "out",
          kind: "boundary",
          x: 2,
          y: 0,
          z: 0,
          fluid: "water",
          pFixed: P_ATM,
        },
      ],
      links: [
        {
          id: "heat",
          from: "in",
          to: "mid",
          fluid: "water",
          component: {
            type: "cold-plate",
            lossModel: "darcy-weisbach",
            geometry: { L: 1, D: 0.03, eps: 0 },
            K: 2,
            q,
          },
        },
        {
          id: "exit",
          from: "mid",
          to: "out",
          fluid: "water",
          component: {
            type: "pipe",
            lossModel: "darcy-weisbach",
            geometry: { L: 1, D: 0.03, eps: 0 },
            K: 0,
          },
        },
      ],
      couplings: [],
    };
    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    const dT = q / (r.links.heat.mdot * WATER.cp);
    expect(r.links.heat.T_out! - r.links.heat.T_in!).toBeCloseTo(dT, 6);
    expect(r.nodes.mid.T).toBeCloseTo(300 + dT, 5);
  });

  it("two-stream HEX rejects the prescribed heater load", () => {
    const q = 2000;
    const project: Project = {
      version: "0.1.0",
      meta: {
        name: "hex-loop",
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
      fluids: { water: WATER, air: AIR_25C },
      analysis: {
        type: "steady",
        flowRegime: "incompressible",
        energy: true,
        gravity: false,
        convergence: conv,
      },
      nodes: [
        {
          id: "tank",
          kind: "tank",
          x: 0,
          y: 0,
          z: 0,
          fluid: "water",
          pFixed: P_ATM + 20000,
        },
        { id: "n1", kind: "junction", x: 1, y: 0, z: 0, fluid: "water" },
        { id: "n2", kind: "junction", x: 2, y: 0, z: 0, fluid: "water" },
        {
          id: "airIn",
          kind: "boundary",
          x: 0,
          y: 1,
          z: 0,
          fluid: "air",
          pFixed: P_ATM,
          tFixed: 298.15,
        },
        { id: "airMid", kind: "junction", x: 1, y: 1, z: 0, fluid: "air" },
        {
          id: "airOut",
          kind: "boundary",
          x: 2,
          y: 1,
          z: 0,
          fluid: "air",
          pFixed: P_ATM,
        },
      ],
      links: [
        {
          id: "pump",
          from: "tank",
          to: "n1",
          fluid: "water",
          component: {
            type: "pump",
            lossModel: "darcy-weisbach",
            geometry: { L: 0, D: 0.02, eps: 0 },
            K: 0,
            pump: { coeffs: [12, 0, -5e7] },
          },
        },
        {
          id: "heater",
          from: "n1",
          to: "n2",
          fluid: "water",
          component: {
            type: "cold-plate",
            lossModel: "darcy-weisbach",
            geometry: { L: 0.3, D: 0.012, eps: 0 },
            K: 4,
            q,
          },
        },
        {
          id: "hexHot",
          from: "n2",
          to: "tank",
          fluid: "water",
          component: {
            type: "hex-stream",
            lossModel: "darcy-weisbach",
            geometry: { L: 0.8, D: 0.016, eps: 0 },
            K: 5,
          },
        },
        {
          id: "fan",
          from: "airIn",
          to: "airMid",
          fluid: "air",
          component: {
            type: "fan",
            lossModel: "darcy-weisbach",
            geometry: { L: 0, D: 0.1, eps: 0 },
            K: 0.5,
            fan: { coeffs: [200, 0, -8000] },
          },
        },
        {
          id: "hexCold",
          from: "airMid",
          to: "airOut",
          fluid: "air",
          component: {
            type: "hex-stream",
            lossModel: "quadratic",
            geometry: { L: 0, D: 0.15, eps: 0 },
            K: 0,
            rQuad: 3500,
          },
        },
      ],
      couplings: [
        {
          id: "hx",
          type: "hex",
          hotLinkId: "hexHot",
          coldLinkId: "hexCold",
          ua: 350,
          arrangement: "crossflow-unmixed",
        },
      ],
    };

    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.couplings.hx.q).toBeCloseTo(q, 0);
    const indep = hexHeat({
      UA: 350,
      C_hot: Math.abs(r.links.hexHot.mdot) * WATER.cp,
      C_cold: Math.abs(r.links.hexCold.mdot) * AIR_25C.cp,
      T_hot_in: r.couplings.hx.T_hot_in,
      T_cold_in: r.couplings.hx.T_cold_in,
      arrangement: "crossflow-unmixed",
    });
    expect(r.couplings.hx.q).toBeCloseTo(indep.q, 4);
    const dTliq =
      q / (Math.abs(r.links.heater.mdot) * WATER.cp);
    expect(r.links.heater.T_out! - r.links.heater.T_in!).toBeCloseTo(dTliq, 4);
  });
});

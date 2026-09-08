import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mf01ExpandedCardStack,
  mf01MultiplicityChassis,
} from "../src/engine/examples/mf01Multiplicity";
import { WATER } from "../src/engine/fluids";
import { solveSteady } from "../src/engine/solve";
import { linkMultiplicity, P_ATM, type Project } from "../src/engine/types";
import table1 from "./fixtures/paper/mf01-table1.json";

const OUT = "tests/fixtures/paper/out";
const CFM = 2118.8799727597;

describe("MF01 multiplicity pattern", () => {
  it("records OCR Table 1 B candidates and rejects them as SI rQuad", () => {
    expect(table1.ocr_B_Pa_per_m3s2.DASD).toBe(1e-4);
    expect(table1.ocr_B_Pa_per_m3s2.Memory).toBe(5e-6);
    // At 30 CFM, OCR DASD B yields ΔP ≪ 0.01 Pa vs Main fan shutoff ~37 Pa.
    const Q = 30 / CFM;
    const dP = table1.ocr_B_Pa_per_m3s2.DASD * Q * Q;
    expect(dP).toBeLessThan(0.01);
    expect(table1.usable_as_si_rquad).toBe(false);
  });

  it("example file and builder use link multiplicity=4, not component.parallelCount", () => {
    const built = mf01MultiplicityChassis();
    const stack = built.links.find((l) => l.id === "card-stack");
    expect(stack?.multiplicity).toBe(4);
    expect(stack?.component.parallelCount).toBeUndefined();
    expect(linkMultiplicity(stack!)).toBe(4);

    const file = JSON.parse(
      readFileSync("examples/mf01-multiplicity-chassis.hydroflow.json", "utf8"),
    ) as Project;
    const fileStack = file.links.find((l) => l.id === "card-stack");
    expect(fileStack?.multiplicity).toBe(4);
    expect(fileStack?.component.parallelCount).toBeUndefined();
  });

  it("multiplicity=4 matches four expanded card links within 1%", () => {
    mkdirSync(OUT, { recursive: true });
    const chassis = mf01MultiplicityChassis();
    const expandedProj = mf01ExpandedCardStack();
    expect(chassis.links.find((l) => l.id === "card-stack")?.multiplicity).toBe(4);
    for (const id of ["card-1", "card-2", "card-3", "card-4"] as const) {
      expect(expandedProj.links.find((l) => l.id === id)?.multiplicity).toBe(1);
    }

    const multi = solveSteady(chassis);
    const expanded = solveSteady(expandedProj);
    expect(multi.status).toBe("converged");
    expect(expanded.status).toBe("converged");
    const qMulti = multi.links["card-stack"].Q;
    const qExp = [1, 2, 3, 4]
      .map((i) => expanded.links[`card-${i}`].Q)
      .reduce((a, b) => a + b, 0);
    const rel = Math.abs(qMulti - qExp) / qExp;
    const rows = [
      "metric\tmultiplicity_CFM\texpanded_CFM\trel_err",
      `card_stack\t${(qMulti * CFM).toFixed(2)}\t${(qExp * CFM).toFixed(2)}\t${(rel * 100).toFixed(3)}%`,
      `main_fan\t${(multi.links["main-fan"].Q * CFM).toFixed(2)}\t${(expanded.links["main-fan"].Q * CFM).toFixed(2)}\t`,
      `psu_fan\t${(multi.links["psu-fan"].Q * CFM).toFixed(2)}\t${(expanded.links["psu-fan"].Q * CFM).toFixed(2)}\t`,
    ];
    writeFileSync(`${OUT}/mf01-multiplicity-comparison.tsv`, rows.join("\n") + "\n");
    expect(rel).toBeLessThanOrEqual(0.01);
    expect(Math.abs(multi.links["card-stack"].dP - expanded.links["card-1"].dP) /
      Math.abs(expanded.links["card-1"].dP)).toBeLessThanOrEqual(0.01);
  });

  it("treats multiplicity N as N identical parallel constitutive instances", () => {
    const rQuad = 2e8;
    const nodes: Project["nodes"] = [
      {
        id: "a",
        kind: "boundary",
        x: 0,
        y: 0,
        z: 0,
        fluid: "water",
        pFixed: P_ATM + 2e4,
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
    ];
    const law = {
      type: "generic-resistance" as const,
      lossModel: "quadratic" as const,
      geometry: { L: 0, D: 0.02, eps: 0 },
      K: 0,
      rQuad,
    };
    const bundled: Project = {
      version: "0.1.0",
      meta: {
        name: "multiplicity identity",
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
        gravity: false,
        convergence: {
          massResidual: 1e-10,
          energyResidual: 1e-8,
          maxIter: 80,
          relaxationP: 0.85,
          relaxationQ: 0.7,
        },
      },
      nodes,
      links: [
        {
          id: "bundle",
          from: "a",
          to: "b",
          fluid: "water",
          multiplicity: 3,
          component: law,
        },
      ],
      couplings: [],
    };
    const copied: Project = {
      ...bundled,
      links: [1, 2, 3].map((i) => ({
        id: `leg-${i}`,
        from: "a",
        to: "b",
        fluid: "water",
        multiplicity: 1,
        component: { ...law },
      })),
    };
    const a = solveSteady(bundled);
    const b = solveSteady(copied);
    expect(a.status).toBe("converged");
    expect(b.status).toBe("converged");
    const qCopied = b.links["leg-1"].Q + b.links["leg-2"].Q + b.links["leg-3"].Q;
    expect(Math.abs(a.links.bundle.Q - qCopied) / qCopied).toBeLessThanOrEqual(0.01);
    expect(Math.abs(a.links.bundle.dP - b.links["leg-1"].dP) / Math.abs(b.links["leg-1"].dP)).toBeLessThanOrEqual(0.01);
  });
});

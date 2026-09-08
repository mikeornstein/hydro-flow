import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { compileDiagram } from "../src/diagram/compile";
import { projectToDiagram } from "../src/diagram/projectToDiagram";
import type { Diagram } from "../src/diagram/types";
import { curveTableNotes, linkDeltaP } from "../src/engine/constitutive";
import { dpTableLossPa, interpTable, pressureOf, sortedByQ, tableRange } from "../src/engine/curve";
import {
  USER_CURVE_FAN_TABLE,
  USER_CURVE_SINK_TABLE,
  userCurveTables,
} from "../src/engine/examples/userCurveTables";
import { WATER, WATER_30C } from "../src/engine/fluids";
import { solveSteady } from "../src/engine/solve";
import { fanCurveRisePa, polyval, pumpCurveHeadM } from "../src/engine/thermo";
import { G, type HeadPoint, type LinkDef, type NodeDef, type Project } from "../src/engine/types";
import { verifySolution } from "../src/engine/verify";
import goldensJson from "./fixtures/goldens.json";
import pumpLoopJson from "../examples/pump-loop.hydroflow.json";
import userCurveJson from "../examples/user-curve-tables.hydroflow.json";

const pumpLoop = pumpLoopJson as unknown as Project;
const schema = JSON.parse(readFileSync("docs/schema/hydroflow.project.schema.json", "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-15);
}

function schemaErrors(project: unknown): string {
  return validate(project) ? "" : ajv.errorsText(validate.errors, { separator: "; " });
}

const nodes: Record<string, NodeDef> = {
  a: { id: "a", kind: "junction", x: 0, y: 0, z: 0, fluid: "water" },
  b: { id: "b", kind: "junction", x: 1, y: 0, z: 0, fluid: "water" },
};

describe("curve table interpolation", () => {
  const table = [
    { Q: 0.02, dP: 200 },
    { Q: 0, dP: 0 },
    { Q: 0.01, dP: 50 },
  ];

  it("hits the knots exactly and is linear between them, whatever the input order", () => {
    expect(interpTable(table, pressureOf, 0).y).toBe(0);
    expect(interpTable(table, pressureOf, 0.01).y).toBe(50);
    expect(interpTable(table, pressureOf, 0.02).y).toBe(200);
    expect(interpTable(table, pressureOf, 0.005).y).toBeCloseTo(25, 12);
    expect(interpTable(table, pressureOf, 0.015).y).toBeCloseTo(125, 12);
    expect(sortedByQ(table).map((p) => p.Q)).toEqual([0, 0.01, 0.02]);
  });

  it("holds the end sample outside the range and says which side", () => {
    expect(interpTable(table, pressureOf, -0.001)).toEqual({ y: 0, range: "below" });
    expect(interpTable(table, pressureOf, 0.03)).toEqual({ y: 200, range: "above" });
    expect(interpTable(table, pressureOf, 0.02).range).toBe("in");
    expect(tableRange(table, 0.03)).toBe("above");
    expect(tableRange(table, 0.015)).toBe("in");
  });

  it("rejects tables that cannot define a curve", () => {
    expect(() => sortedByQ([{ Q: 0 }])).toThrow(/two points/);
    expect(() => sortedByQ([{ Q: 0 }, { Q: 0 }])).toThrow(/repeats Q/);
    expect(() => sortedByQ([{ Q: 0 }, { Q: Number.NaN }])).toThrow(/non-finite/);
  });
});

describe("dpTable loss", () => {
  const sink = [
    { Q: 0.01, dP: 50 },
    { Q: 0.02, dP: 200 },
  ];

  it("is odd in Q, linear to the origin below the first sample, held above the last", () => {
    expect(dpTableLossPa(sink, 0.015)).toBeCloseTo(125, 12);
    expect(dpTableLossPa(sink, -0.015)).toBeCloseTo(-125, 12);
    expect(dpTableLossPa(sink, 0.005)).toBeCloseTo(25, 12);
    expect(dpTableLossPa(sink, -0.005)).toBeCloseTo(-25, 12);
    expect(dpTableLossPa(sink, 0)).toBe(0);
    expect(dpTableLossPa(sink, 0.05)).toBe(200);
    expect(dpTableLossPa(sink, -0.05)).toBe(-200);
  });

  it("adds to the link's other losses on a per-path basis", () => {
    const link: LinkDef = {
      id: "s",
      from: "a",
      to: "b",
      fluid: "water",
      component: {
        type: "generic-resistance",
        lossModel: "linear",
        geometry: { L: 0, D: 0.05, eps: 0 },
        K: 0,
        rLin: 1000,
        dpTable: USER_CURVE_SINK_TABLE,
        parallelCount: 2,
      },
    };
    const ev = linkDeltaP(link, 0.024, WATER, nodes, false);
    expect(ev.loss).toBeCloseTo(1000 * 0.012 + 96, 9);
    expect(ev.rise).toBe(0);
    expect(ev.dP).toBeCloseTo(ev.loss, 9);
  });
});

describe("pump and fan tables", () => {
  it("table takes precedence over coeffs; hMin still clamps; reverse flow uses shutoff", () => {
    const table: HeadPoint[] = [
      { Q: 0, H: 10 },
      { Q: 0.01, H: 5 },
      { Q: 0.02, H: 0 },
    ];
    const curve = { coeffs: [30, 0, -2000], hMin: 2, table };
    expect(pumpCurveHeadM(curve, 0.005)).toBeCloseTo(7.5, 12);
    expect(pumpCurveHeadM(curve, 0.02)).toBe(2);
    expect(pumpCurveHeadM(curve, 0.05)).toBe(2);
    expect(pumpCurveHeadM(curve, -0.001)).toBeCloseTo(10 - 8e8 * 1e-6, 9);
    expect(pumpCurveHeadM({ coeffs: [30, 0, -2000] }, 0.005)).toBeCloseTo(29.95, 12);
    expect(() => pumpCurveHeadM({}, 0.01)).toThrow(/coeffs or a table/);
  });

  it("fan table matches the sampled law at its knots and between them", () => {
    const fan = { table: USER_CURVE_FAN_TABLE };
    expect(fanCurveRisePa(fan, 0)).toBe(150);
    expect(fanCurveRisePa(fan, 0.075)).toBe(0);
    expect(fanCurveRisePa(fan, 0.04375)).toBeCloseTo((112.5 + 83.3) / 2, 12);
    expect(fanCurveRisePa(fan, 0.1)).toBe(0);
    expect(() => fanCurveRisePa({}, 0.01)).toThrow(/coeffs or a table/);
  });

  it("U12: pump-loop with a 13-point sampled H(Q) table lands on Golden B within 1%", () => {
    const golden = goldensJson.cases.find((c) => c.id === "B-pump-loop")!;
    const expectedQ = golden.expected.links.pump.Q;
    const project = structuredClone(pumpLoop);
    const pumpLink = project.links.find((l) => l.id === "pump")!;
    const coeffs = pumpLink.component.pump!.coeffs!;
    const table: HeadPoint[] = [];
    for (let i = 0; i <= 12; i++) {
      const Q = 0.01 * i;
      table.push({ Q, H: Math.max(0, polyval(coeffs, Q)) });
    }
    pumpLink.component.pump = { table };

    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.warnings).toEqual([]);
    expect(relErr(r.links.pump.Q, expectedQ)).toBeLessThan(0.01);
    expect(relErr(r.links.pump.Q, expectedQ)).toBeLessThan(2e-3);
    const rho = project.fluids[pumpLink.fluid].rho;
    const H = r.links.pump.rise / (rho * G);
    expect(relErr(H, polyval(coeffs, r.links.pump.Q))).toBeLessThan(2e-3);
    expect(H).toBeCloseTo(pumpCurveHeadM({ table }, r.links.pump.Q), 9);
    expect(verifySolution(project, r).pass).toBe(true);
  });
});

describe("user-curve-tables example", () => {
  it("solves on both tables with no range warnings and lands within 2% of the closed forms", () => {
    const tabulated = solveSteady(userCurveTables("table"));
    const smooth = solveSteady(userCurveTables("closed-form"));
    expect(tabulated.status).toBe("converged");
    expect(smooth.status).toBe("converged");
    expect(tabulated.warnings).toEqual([]);
    for (const id of ["fan", "heat-sink", "bypass"] as const) {
      expect(relErr(tabulated.links[id].Q, smooth.links[id].Q), id).toBeLessThan(0.02);
    }
    expect(tabulated.links["heat-sink"].Q).toBeGreaterThan(0.008);
    expect(tabulated.links["heat-sink"].Q).toBeLessThan(0.016);
    expect(verifySolution(userCurveTables("table"), tabulated).pass).toBe(true);
  });

  it("puts the operating point on both tables exactly", () => {
    const r = solveSteady(userCurveTables("table"));
    const fan = r.links.fan;
    const sink = r.links["heat-sink"];
    expect(fan.rise).toBeCloseTo(interpTable(USER_CURVE_FAN_TABLE, pressureOf, fan.Q).y, 9);
    expect(sink.loss).toBeCloseTo(dpTableLossPa(USER_CURVE_SINK_TABLE, sink.Q), 9);
    expect(sink.loss).toBeCloseTo(r.links.bypass.loss, 6);
  });

  it("warns once per link when the solved flow leaves a table", () => {
    const truncatedSink = userCurveTables("table");
    truncatedSink.links[1].component.dpTable = USER_CURVE_SINK_TABLE.slice(0, 3);
    const above = solveSteady(truncatedSink);
    expect(above.status).toBe("converged");
    expect(above.warnings).toHaveLength(1);
    expect(above.warnings[0]).toContain("heat-sink");
    expect(above.warnings[0]).toContain("above its last sample");
    expect(above.warnings[0]).toContain("loss held");

    const lateFan = userCurveTables("table");
    lateFan.links[0].component.fan = { table: USER_CURVE_FAN_TABLE.slice(4) };
    const below = solveSteady(lateFan);
    expect(below.status).toBe("converged");
    expect(below.warnings).toHaveLength(1);
    expect(below.warnings[0]).toContain("[fan]");
    expect(below.warnings[0]).toContain("below its first sample");
    expect(below.links.fan.Q).toBeLessThan(0.05);
    expect(below.links.fan.rise).toBeCloseTo(83.3, 9);

    const gappedSink = userCurveTables("table");
    gappedSink.links[1].component.dpTable = USER_CURVE_SINK_TABLE.slice(4);
    const origin = solveSteady(gappedSink);
    expect(origin.status).toBe("converged");
    expect(origin.warnings).toHaveLength(1);
    expect(origin.warnings[0]).toContain("linear to the origin");
  });

  it("curveTableNotes is silent inside the range and per-path aware", () => {
    const link = userCurveTables("table").links[1];
    expect(curveTableNotes(link, 0.012)).toEqual([]);
    expect(curveTableNotes(link, 0.03)).toHaveLength(1);
    link.component.parallelCount = 2;
    expect(curveTableNotes(link, 0.03)).toEqual([]);
  });
});

describe("tables round-trip through .hydroflow.json", () => {
  it("committed example equals the builder, validates, and re-solves identically after JSON", () => {
    const built = userCurveTables("table");
    expect(userCurveJson).toEqual(built);
    expect(schemaErrors(userCurveJson)).toBe("");
    const reparsed = JSON.parse(JSON.stringify(built)) as Project;
    expect(reparsed.links[0].component.fan?.table).toEqual(USER_CURVE_FAN_TABLE);
    expect(reparsed.links[1].component.dpTable).toEqual(USER_CURVE_SINK_TABLE);
    expect(solveSteady(reparsed).links.fan.Q).toBe(solveSteady(built).links.fan.Q);
  });

  it("schema requires coeffs or table, two samples, and Q ≥ 0", () => {
    const base = userCurveTables("table");
    const noCurve = structuredClone(base);
    noCurve.links[0].component.fan = {};
    expect(schemaErrors(noCurve)).toMatch(/required property/);

    const onePoint = structuredClone(base);
    onePoint.links[1].component.dpTable = [{ Q: 0, dP: 0 }];
    expect(schemaErrors(onePoint)).toMatch(/fewer than 2 items/);

    const negativeQ = structuredClone(base);
    negativeQ.links[1].component.dpTable = [
      { Q: -0.01, dP: -10 },
      { Q: 0.01, dP: 10 },
    ];
    expect(schemaErrors(negativeQ)).toMatch(/>= 0/);

    const polynomialStill = structuredClone(base);
    polynomialStill.links[0].component.fan = { coeffs: [150, 0, -26667] };
    expect(schemaErrors(polynomialStill)).toBe("");
  });

  it("canvas tables compile into the project, validate, and survive project → diagram → project", () => {
    const table: HeadPoint[] = [
      { Q: 0, H: 16 },
      { Q: 2e-4, H: 12 },
      { Q: 4e-4, H: 0 },
    ];
    const diagram: Diagram = {
      id: "t",
      name: "tables",
      description: "",
      nodes: [
        { id: "src", kind: "tank", name: "Tank", x: 0, y: 0, z: 0, fluid: WATER_30C.id, params: { pFixed: 101325 } },
        { id: "pump", kind: "pump", name: "Pump", x: 100, y: 0, z: 0, fluid: WATER_30C.id, params: { D: 0.025, K: 1, pump: { table } } },
        { id: "sink", kind: "boundary", name: "Sink", x: 200, y: 0, z: 0, fluid: WATER_30C.id, params: { pFixed: 101325 } },
      ],
      edges: [
        { id: "e1", from: { node: "src", port: "port" }, to: { node: "pump", port: "in" }, kind: "pipe", fluid: WATER_30C.id, geometry: { L: 1, D: 0.02, eps: 1.5e-6, K: 0.4 } },
        {
          id: "e2",
          from: { node: "pump", port: "out" },
          to: { node: "sink", port: "port" },
          kind: "pipe",
          fluid: WATER_30C.id,
          geometry: { L: 1, D: 0.02, eps: 1.5e-6, K: 0.4 },
          dpTable: [
            { Q: 0, dP: 0 },
            { Q: 2e-4, dP: 40000 },
            { Q: 4e-4, dP: 160000 },
          ],
        },
      ],
    };
    const project = compileDiagram(diagram, { createdAt: "2026-09-08T00:00:00Z" });
    expect(schemaErrors(project)).toBe("");
    expect(project.links.find((l) => l.id === "pump.core")!.component.pump).toEqual({ table });
    expect(project.links.find((l) => l.id === "e2")!.component.dpTable).toEqual(diagram.edges[1].dpTable);

    const r = solveSteady(project);
    expect(r.status).toBe("converged");
    expect(r.warnings).toEqual([]);
    const Q = r.links["pump.core"].Q;
    expect(Q).toBeGreaterThan(0);
    expect(r.links["pump.core"].rise).toBeCloseTo(WATER_30C.rho * G * pumpCurveHeadM({ table }, Q), 9);
    expect(r.links.e2.loss).toBeGreaterThan(dpTableLossPa(diagram.edges[1].dpTable!, Q));

    const back = projectToDiagram(project);
    const mid = back.nodes.find((n) => n.id === "eq:pump.core")!;
    expect(mid.params.pump).toEqual({ table });
    expect(back.edges.find((e) => e.id === "e2")!.dpTable).toEqual(diagram.edges[1].dpTable);
    const again = compileDiagram(back);
    expect(schemaErrors(again)).toBe("");
    expect(again.links.find((l) => l.id === "eq:pump.core.core")!.component.pump).toEqual({ table });
  });

  it("file-backed example recompiles from its canvas diagram with both tables intact", () => {
    const project = userCurveTables("table");
    const diagram = projectToDiagram(project);
    const recompiled = compileDiagram(diagram);
    const fan = recompiled.links.find((l) => l.id === "eq:fan.core")!;
    const sink = recompiled.links.find((l) => l.id === "heat-sink")!;
    expect(fan.component.fan?.table).toEqual(USER_CURVE_FAN_TABLE);
    expect(sink.component.dpTable).toEqual(USER_CURVE_SINK_TABLE);
    const pinned = solveSteady(project);
    const r = solveSteady(recompiled);
    expect(r.status).toBe("converged");
    expect(relErr(r.links["eq:fan.core"].Q, pinned.links.fan.Q)).toBeLessThan(0.03);
  });
});

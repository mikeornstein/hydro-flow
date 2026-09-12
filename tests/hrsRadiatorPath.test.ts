import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDiagram } from "../src/diagram/compile";
import { projectToDiagram } from "../src/diagram/projectToDiagram";
import { IssAtcs, IssAtcsFigures } from "../src/engine/examples/issAtcs";
import { HrsRadiatorPath } from "../src/engine/examples/hrsRadiatorPath";
import { ModuleNetwork } from "../src/engine/moduleNetwork";
import { solveSteady } from "../src/engine/solve";
import { verifySolution } from "../src/engine/verify";
import { loadExamplePayload } from "../src/ui/examples/catalog";
import { equipmentReadout } from "../src/ui/flow/equipmentReadout";

const DEMO_FILE = `examples/${HrsRadiatorPath.FILE}`;

describe("Heat Rejection Subsystem Orbital Replaceable Unit path", () => {
  const project = HrsRadiatorPath.project();
  const result = solveSteady(project);
  const report = verifySolution(project, result);
  const summary = HrsRadiatorPath.summarize(project, result);

  it("keeps a compact modular deck", () => {
    expect(project.modules).toHaveLength(1);
    expect(project.modules?.[0]).toEqual(
      expect.objectContaining({ id: "radiator-panel", kind: "u-manifold-pack" }),
    );
    expect(project.instances).toHaveLength(HrsRadiatorPath.COUNTS.panelsPerOru);
    expect(project.instances?.every((i) => i.count === 1)).toBe(true);
    expect(new Set(project.instances?.map((i) => i.ports.inlet)).size).toBe(8);
    expect(project.links.filter((l) => l.id.includes("cross-"))).toEqual([]);
    expect(project.analysis.energy).toBe(false);
    expect(project.analysis.gravity).toBe(false);
    expect(project.couplings).toEqual([]);
  });

  it("expands to the published part counts", () => {
    const flat = ModuleNetwork.expand(project);
    expect(HrsRadiatorPath.countTopology(project)).toEqual(HrsRadiatorPath.EXPECTED_COUNTS);
    expect(HrsRadiatorPath.countTopology(flat)).toEqual({
      panels: 8,
      tubes: 88,
      flexHoses: 7,
      valveModulePorts: 2,
    });
    expect(HrsRadiatorPath.EXPECTED_COUNTS.tubes).toBe(
      HrsRadiatorPath.COUNTS.panelsPerOru * HrsRadiatorPath.COUNTS.tubesPerPathPerPanel,
    );
    expect(HrsRadiatorPath.STATION).toEqual({
      orbitalReplaceableUnits: 6,
      panels: 48,
      paths: 12,
      pathsPerLoop: 6,
      panelTubes: 1056,
    });
    expect(project.instances).toHaveLength(8);
    expect(flat.modules).toBeUndefined();
  });

  it("carries no flight geometry", () => {
    const a = HrsRadiatorPath.ASSUMPTIONS;
    expect(a.tag).toBe("NOT flight-published");
    expect(a.name).toBe("hrs-path-baseline-v1");
    expect(a.tube.D.value).not.toBe(0.005);
    expect(a.manifold.D.value).not.toBe(0.012);
    expect(project.meta.description).toContain(a.name);
    expect(project.meta.description).toContain("NOT flight-published");
    expect(project.meta.description).toMatch(/AIAA A35030/);
  });

  it("converges with verification on hydraulics only", () => {
    expect(result.status, result.warnings.join("; ")).toBe("converged");
    expect(report.pass).toBe(true);
    expect(report.checks.map((c) => c.id)).not.toContain("energy-global");
  });

  it("drives the published Loop A share and returns at 300 psia", () => {
    expect(summary.mdotPathKgS).toBeCloseTo(HrsRadiatorPath.pathMassFlowKgS(), 9);
    expect(IssAtcsFigures.kgSToLbH(summary.mdotPathKgS)).toBeCloseTo(
      IssAtcsFigures.LOOP_A_LB_H / HrsRadiatorPath.STATION.pathsPerLoop,
      6,
    );
    expect(result.nodes.return.P).toBeCloseTo(IssAtcsFigures.pumpInletPa(), 0);
    expect(summary.pathDpPa).toBeGreaterThan(0);
  });

  it("keeps eight series panel drops equal", () => {
    const mean = summary.panelDpPa.reduce((s, v) => s + v, 0) / summary.panelDpPa.length;
    expect(summary.panelDpPa).toHaveLength(8);
    for (const dp of summary.panelDpPa) {
      expect(Math.abs(dp / mean - 1)).toBeLessThan(1e-6);
    }
    const inlet = result.links["rbvm-inlet-port"].Q;
    for (let k = 1; k <= 8; k++) {
      const q = result.links[ModuleNetwork.inletLinkId(`panel-${k}`, 0)].Q;
      expect(Math.abs(q / inlet - 1)).toBeLessThan(1e-9);
    }
  });

  it("does not treat lumped and part-level results as equivalent", () => {
    const lumpedProject = IssAtcs.project();
    const lumpedResult = solveSteady(lumpedProject);
    const findings = HrsRadiatorPath.audit({ project, result }, { project: lumpedProject, result: lumpedResult });
    const byId = Object.fromEntries(findings.map((f) => [f.id, f]));
    expect(Object.keys(byId).sort()).toEqual(
      [
        "flow-per-path",
        "heat-rejection",
        "path-dp",
        "topology-parallel-paths",
        "topology-series-panels",
        "topology-tubes",
      ].sort(),
    );
    expect(byId["topology-parallel-paths"]).toMatchObject({
      lumped: 3,
      partLevel: 6,
      consistent: false,
      rootCause: "lumped-vs-part-level",
    });
    expect(byId["topology-tubes"]).toMatchObject({ lumped: 0, partLevel: 88, consistent: false });
    expect(byId["topology-series-panels"]).toMatchObject({ lumped: 1, partLevel: 8, consistent: false });
    expect(byId["path-dp"].consistent).toBe(false);
    expect(byId["path-dp"].rootCause).toBe("assumed-hydraulics");
    expect(byId["heat-rejection"].partLevel).toBe(0);
    expect(byId["heat-rejection"].rootCause).toBe("out-of-slice");
    expect(byId["heat-rejection"].lumped).toBeCloseTo(IssAtcsFigures.EATCS_LOOP_W, 0);
    expect(byId["flow-per-path"].consistent).toBe(false);
  });

  it("drops path pressure drop as assumed tube diameter grows (sensitivity, not a citation)", () => {
    const rows = [0.006, 0.008, 0.01].map((D) => {
      const p = HrsRadiatorPath.project(HrsRadiatorPath.withTubeD(D));
      return HrsRadiatorPath.summarize(p, solveSteady(p)).pathDpPa;
    });
    expect(rows[0]).toBeGreaterThan(rows[1]);
    expect(rows[1]).toBeGreaterThan(rows[2]);
  }, 30_000);

  it("round-trips through JSON and the committed example file", () => {
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    const file = JSON.parse(readFileSync(DEMO_FILE, "utf8"));
    expect(file).toEqual(project);
  });

  it("loads from the catalog as a pinned project", () => {
    const payload = loadExamplePayload(HrsRadiatorPath.ID);
    expect(payload.pinnedProject).toEqual(project);
    expect(payload.entry.file).toBe(HrsRadiatorPath.FILE);
    expect(payload.diagram.nodes.filter((n) => n.kind === "coldPlate")).toHaveLength(8);
    expect(payload.diagram.nodes.filter((n) => n.kind === "radiator")).toHaveLength(0);
    expect(payload.diagram.nodes.filter((n) => n.kind === "valve")).toHaveLength(2);
    for (const plate of payload.diagram.nodes.filter((n) => n.kind === "coldPlate")) {
      expect(equipmentReadout(plate, result)).not.toBe("—");
      expect(equipmentReadout(plate, result)).not.toBe("unsolved");
    }
  });

  it("canvas recompile converges without the pinned mass source", () => {
    const diagram = projectToDiagram(project);
    const compiled = compileDiagram(diagram);
    const r = solveSteady(compiled);
    expect(r.status).toBe("converged");
    expect(compiled.nodes.some((n) => n.mdotSource)).toBe(false);
  });
});

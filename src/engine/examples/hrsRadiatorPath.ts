import { ModuleNetwork } from "../moduleNetwork";
import type {
  ChannelPackParams,
  InstanceDef,
  LinkDef,
  ModuleDef,
  NodeDef,
  Project,
  SolveResult,
} from "../types";
import { EATCS_NH3, IssAtcsFigures } from "./issAtcs";
import { EXAMPLE_PITCH_X, EXAMPLE_PITCH_Y } from "./canvasPitch";

const NH = EATCS_NH3.id;
const CREATED = "2026-09-12T00:00:00Z";

export interface HrsPublishedCounts {
  readonly panelsPerOru: 8;
  readonly pathsPerOru: 2;
  readonly tubesPerPathPerPanel: 11;
  readonly flexHosesPerPath: 7;
  readonly valveModulesPerOru: 2;
  readonly portsPerValveModule: 2;
  readonly orusPerWing: 3;
  readonly wings: 2;
  readonly ammoniaLoops: 2;
}

export interface HrsPathCounts {
  readonly panels: number;
  readonly tubes: number;
  readonly flexHoses: number;
  readonly valveModulePorts: number;
}

export interface HrsStationCounts {
  readonly orbitalReplaceableUnits: number;
  readonly panels: number;
  readonly paths: number;
  readonly pathsPerLoop: number;
  readonly panelTubes: number;
}

export type HrsAssumptionBasis =
  | "model-assumption"
  | "published-envelope-bound"
  | "derived-from-published";

export interface HrsAssumed {
  readonly value: number;
  readonly basis: HrsAssumptionBasis;
  readonly note: string;
}

export interface HrsPathAssumptions {
  readonly name: string;
  readonly tag: "NOT flight-published";
  readonly tube: { readonly D: HrsAssumed; readonly L: HrsAssumed; readonly eps: HrsAssumed };
  readonly manifold: { readonly D: HrsAssumed; readonly pitch: HrsAssumed };
  readonly flexHose: { readonly D: HrsAssumed; readonly L: HrsAssumed; readonly K: HrsAssumed };
  readonly valvePort: { readonly D: HrsAssumed; readonly L: HrsAssumed; readonly K: HrsAssumed };
  readonly tees: boolean;
}

export interface HrsPathSummary {
  readonly mdotPathKgS: number;
  readonly pathDpPa: number;
  readonly panelDpPa: readonly number[];
  readonly flexDpPa: readonly number[];
  readonly valvePortDpPa: readonly [number, number];
  readonly tube: {
    readonly minQ: number;
    readonly maxQ: number;
    readonly meanQ: number;
    readonly spreadFraction: number;
    readonly maxRe: number;
  };
  readonly counts: HrsPathCounts;
}

export type HrsAuditFindingId =
  | "topology-parallel-paths"
  | "topology-series-panels"
  | "topology-tubes"
  | "flow-per-path"
  | "path-dp"
  | "heat-rejection";

export type HrsAuditRootCause =
  | "lumped-vs-part-level"
  | "assumed-hydraulics"
  | "model-pump-sizing"
  | "out-of-slice"
  | "published";

export interface HrsAuditFinding {
  readonly id: HrsAuditFindingId;
  readonly subject: string;
  readonly lumped: number;
  readonly partLevel: number;
  readonly unit: string;
  readonly consistent: boolean;
  readonly rootCause: HrsAuditRootCause;
  readonly note: string;
}

export class HrsRadiatorPath {
  static readonly ID = "iss-hrs-oru-path";
  static readonly FILE = "iss-hrs-oru-path.hydroflow.json";
  static readonly TITLE =
    "Heat Rejection Subsystem radiator: one ammonia path through one Orbital Replaceable Unit";

  static readonly COUNTS: HrsPublishedCounts = {
    panelsPerOru: 8,
    pathsPerOru: 2,
    tubesPerPathPerPanel: 11,
    flexHosesPerPath: 7,
    valveModulesPerOru: 2,
    portsPerValveModule: 2,
    orusPerWing: 3,
    wings: 2,
    ammoniaLoops: 2,
  };

  static readonly EXPECTED_COUNTS: HrsPathCounts = HrsRadiatorPath.expectedOf(
    HrsRadiatorPath.COUNTS,
  );

  static readonly STATION: HrsStationCounts = HrsRadiatorPath.stationOf(HrsRadiatorPath.COUNTS);

  static readonly ASSUMPTIONS: HrsPathAssumptions = HrsRadiatorPath.baselineAssumptions();

  static readonly DESCRIPTION = HrsRadiatorPath.buildDescription(HrsRadiatorPath.ASSUMPTIONS);

  static readonly LUMPED_EXAMPLE_ID = "iss-atcs";
  static readonly LUMPED_WING_LINK_ID = "a-rad";
  static readonly LUMPED_PUMP_LINK_ID = "a-pump";

  static catalogCopy(): {
    id: string;
    title: string;
    description: string;
    group: "Spacecraft thermal";
    file: string;
  } {
    return {
      id: HrsRadiatorPath.ID,
      title: HrsRadiatorPath.TITLE,
      description: HrsRadiatorPath.DESCRIPTION,
      group: "Spacecraft thermal",
      file: HrsRadiatorPath.FILE,
    };
  }

  static pathMassFlowKgS(): number {
    return IssAtcsFigures.loopAKgS() / HrsRadiatorPath.STATION.pathsPerLoop;
  }

  static withTubeD(tubeD: number): HrsPathAssumptions {
    const base = HrsRadiatorPath.ASSUMPTIONS;
    return {
      ...base,
      name: `${base.name}/tubeD=${tubeD}`,
      tube: {
        ...base.tube,
        D: {
          ...base.tube.D,
          value: tubeD,
          note: `Tube inside diameter ${tubeD * 1000} mm. Model assumption for a sensitivity sweep, not a flight dimension.`,
        },
      },
    };
  }

  static project(assumptions: HrsPathAssumptions = HrsRadiatorPath.ASSUMPTIONS): Project {
    HrsRadiatorPath.assertAssumptions(assumptions);
    const c = HrsRadiatorPath.COUNTS;
    const nodes: NodeDef[] = [HrsRadiatorPath.supplyNode(), HrsRadiatorPath.returnNode()];
    for (let k = 1; k <= c.panelsPerOru; k++) {
      const lay = HrsRadiatorPath.panelLayout(k);
      nodes.push({
        id: HrsRadiatorPath.panelInletPortId(k),
        kind: "junction",
        name: `Panel ${k} supply manifold`,
        x: lay.inX,
        y: lay.y,
        z: 0,
        fluid: NH,
      });
      nodes.push({
        id: HrsRadiatorPath.panelOutletPortId(k),
        kind: "junction",
        name: `Panel ${k} return manifold`,
        x: lay.outX,
        y: lay.y,
        z: 0,
        fluid: NH,
      });
    }

    const links: LinkDef[] = [
      HrsRadiatorPath.valvePort(
        "inlet",
        HrsRadiatorPath.SUPPLY_ID,
        HrsRadiatorPath.panelInletPortId(1),
        assumptions,
      ),
    ];
    for (let k = 1; k <= c.flexHosesPerPath; k++) {
      links.push(
        HrsRadiatorPath.flexPipe(
          k,
          HrsRadiatorPath.panelOutletPortId(k),
          HrsRadiatorPath.panelInletPortId(k + 1),
          assumptions,
        ),
      );
    }
    links.push(
      HrsRadiatorPath.valvePort(
        "outlet",
        HrsRadiatorPath.panelOutletPortId(c.panelsPerOru),
        HrsRadiatorPath.RETURN_ID,
        assumptions,
      ),
    );

    const instances: InstanceDef[] = [];
    for (let k = 1; k <= c.panelsPerOru; k++) {
      instances.push(HrsRadiatorPath.panelInstance(k));
    }

    return {
      version: "0.1.0",
      meta: {
        name: HrsRadiatorPath.TITLE,
        description: HrsRadiatorPath.buildDescription(assumptions),
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      units: {
        system: "SI",
        length: "m",
        pressure: "kPa",
        flow: "L/min",
        temperature: "C",
        power: "kW",
      },
      fluids: { [EATCS_NH3.id]: EATCS_NH3 },
      analysis: {
        type: "steady",
        flowRegime: "incompressible",
        energy: false,
        gravity: false,
        convergence: {
          massResidual: 1e-10,
          energyResidual: 1e-8,
          maxIter: 80,
          relaxationP: 0.8,
          relaxationQ: 0.7,
        },
      },
      nodes,
      links,
      couplings: [],
      modules: [HrsRadiatorPath.panelModule(assumptions)],
      instances,
    };
  }

  static countTopology(project: Project): HrsPathCounts {
    const flat = ModuleNetwork.expand(project);
    const tubes = flat.links.filter((l) => HrsRadiatorPath.TUBE_LINK.test(l.id));
    const flex = flat.links.filter((l) => HrsRadiatorPath.FLEX_LINK.test(l.id));
    const inlet = flat.links.find((l) => l.id === HrsRadiatorPath.RBVM_INLET_ID);
    const outlet = flat.links.find((l) => l.id === HrsRadiatorPath.RBVM_OUTLET_ID);
    const valveModulePorts =
      (inlet?.component.type === "valve" ? 1 : 0) + (outlet?.component.type === "valve" ? 1 : 0);
    const panelIds = new Set(
      flat.links
        .map((l) => l.id.match(/^(panel-\d+)#/)?.[1])
        .filter((id): id is string => id !== undefined),
    );
    return {
      panels: panelIds.size,
      tubes: tubes.length,
      flexHoses: flex.length,
      valveModulePorts,
    };
  }

  static summarize(project: Project, result: SolveResult): HrsPathSummary {
    const inlet = result.links[HrsRadiatorPath.RBVM_INLET_ID];
    if (!inlet) {
      throw new Error(
        "Summary expects the Heat Rejection Subsystem path (Radiator Beam Valve Module inlet port).",
      );
    }
    const supply = result.nodes[HrsRadiatorPath.SUPPLY_ID];
    const ret = result.nodes[HrsRadiatorPath.RETURN_ID];
    if (!supply || !ret) {
      throw new Error("Summary expects the path supply and return nodes.");
    }
    const c = HrsRadiatorPath.COUNTS;
    const panelDpPa: number[] = [];
    for (let k = 1; k <= c.panelsPerOru; k++) {
      const inn = result.nodes[HrsRadiatorPath.panelInletPortId(k)];
      const out = result.nodes[HrsRadiatorPath.panelOutletPortId(k)];
      if (!inn || !out) {
        throw new Error(`Summary expects panel ${k} manifold nodes.`);
      }
      panelDpPa.push(inn.P - out.P);
    }
    const flexDpPa: number[] = [];
    for (let k = 1; k <= c.flexHosesPerPath; k++) {
      const link = result.links[HrsRadiatorPath.flexId(k)];
      if (!link) throw new Error(`Summary expects flex hose ${k}.`);
      flexDpPa.push(link.dP);
    }
    const outlet = result.links[HrsRadiatorPath.RBVM_OUTLET_ID];
    if (!outlet) {
      throw new Error("Summary expects the Radiator Beam Valve Module outlet port.");
    }

    const tubeQs: number[] = [];
    let maxRe = 0;
    for (let k = 1; k <= c.panelsPerOru; k++) {
      for (const id of HrsRadiatorPath.tubeIds(k)) {
        const t = result.links[id];
        if (!t) throw new Error(`Summary expects tube ${id}.`);
        tubeQs.push(t.Q);
        maxRe = Math.max(maxRe, t.Re);
      }
    }
    const minQ = Math.min(...tubeQs);
    const maxQ = Math.max(...tubeQs);
    const meanQ = tubeQs.reduce((a, b) => a + b, 0) / tubeQs.length;

    return {
      mdotPathKgS: Math.abs(inlet.mdot),
      pathDpPa: supply.P - ret.P,
      panelDpPa,
      flexDpPa,
      valvePortDpPa: [inlet.dP, outlet.dP],
      tube: {
        minQ,
        maxQ,
        meanQ,
        spreadFraction: meanQ === 0 ? 0 : (maxQ - minQ) / meanQ,
        maxRe,
      },
      counts: HrsRadiatorPath.countTopology(project),
    };
  }

  static audit(
    part: { project: Project; result: SolveResult },
    lumped: { project: Project; result: SolveResult },
  ): readonly HrsAuditFinding[] {
    const wing = lumped.project.links.find((l) => l.id === HrsRadiatorPath.LUMPED_WING_LINK_ID);
    const pump = lumped.result.links[HrsRadiatorPath.LUMPED_PUMP_LINK_ID];
    const wingResult = lumped.result.links[HrsRadiatorPath.LUMPED_WING_LINK_ID];
    if (!wing || !pump || !wingResult) {
      throw new Error("Audit expects the ISS Active Thermal Control System demo (iss-atcs).");
    }
    const summary = HrsRadiatorPath.summarize(part.project, part.result);
    const parallel = wing.component.parallelCount ?? 1;
    const lumpedPathMdot = Math.abs(pump.mdot) / parallel;
    const lumpedHeat = -(wingResult.q ?? 0);

    const rel = (a: number, b: number) =>
      Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-15) <= 0.05;

    return [
      {
        id: "topology-parallel-paths",
        subject: "Parallel ammonia paths per External Active Thermal Control System loop",
        lumped: parallel,
        partLevel: HrsRadiatorPath.STATION.pathsPerLoop,
        unit: "",
        consistent: rel(parallel, HrsRadiatorPath.STATION.pathsPerLoop),
        rootCause: "lumped-vs-part-level",
        note: "Active Thermal Control System link a-rad uses parallelCount 3 (three Orbital Replaceable Units). This path treats each Orbital Replaceable Unit as two independent paths, so one loop has six paths.",
      },
      {
        id: "topology-series-panels",
        subject: "Radiator panels on one path",
        lumped: 1,
        partLevel: summary.counts.panels,
        unit: "",
        consistent: rel(1, summary.counts.panels),
        rootCause: "lumped-vs-part-level",
        note: "a-rad is one lumped wing link. This deck is eight series panels.",
      },
      {
        id: "topology-tubes",
        subject: "Inconel flow tubes resolved on one path",
        lumped: 0,
        partLevel: summary.counts.tubes,
        unit: "",
        consistent: rel(0, summary.counts.tubes),
        rootCause: "lumped-vs-part-level",
        note: "a-rad has no tube links. This path expands eleven tubes per panel times eight panels.",
      },
      {
        id: "flow-per-path",
        subject: "Ammonia mass flow assigned to one path",
        lumped: lumpedPathMdot,
        partLevel: summary.mdotPathKgS,
        unit: "kg/s",
        consistent: rel(lumpedPathMdot, summary.mdotPathKgS),
        rootCause: "lumped-vs-part-level",
        note: "Lumped per-path flow is |a-pump.mdot| / 3. This deck uses published Loop A 8200 lb/h shared over six paths. The lumped pump also sits above 8200 lb/h (model pump sizing).",
      },
      {
        id: "path-dp",
        subject: "Path pressure drop",
        lumped: wingResult.dP,
        partLevel: summary.pathDpPa,
        unit: "Pa",
        consistent: rel(wingResult.dP, summary.pathDpPa),
        rootCause: "assumed-hydraulics",
        note: `a-rad loss uses lumped L ${wing.component.geometry.L} m, D ${wing.component.geometry.D} m, K ${wing.component.K} (model sizing). This path sums assumed tube, manifold, flex, and valve losses from ${HrsRadiatorPath.ASSUMPTIONS.name}. Neither is a flight pressure drop.`,
      },
      {
        id: "heat-rejection",
        subject: "Heat rejected on this path",
        lumped: lumpedHeat,
        partLevel: 0,
        unit: "W",
        consistent: rel(lumpedHeat, 0),
        rootCause: "out-of-slice",
        note: "a-rad rejects the 35 kW nameplate. This deck is hydraulic only (energy off, pipe laterals, no tube UA).",
      },
    ];
  }

  private static readonly SUPPLY_ID = "supply";
  private static readonly RETURN_ID = "return";
  private static readonly MODULE_ID = "radiator-panel";
  private static readonly RBVM_INLET_ID = "rbvm-inlet-port";
  private static readonly RBVM_OUTLET_ID = "rbvm-outlet-port";
  private static readonly TUBE_LINK = /^panel-\d+#0:cross-\d+$/;
  private static readonly FLEX_LINK = /^flex-\d+$/;

  private static panelId(k: number): string {
    return `panel-${k}`;
  }
  private static panelInletPortId(k: number): string {
    return `p${k}-in`;
  }
  private static panelOutletPortId(k: number): string {
    return `p${k}-out`;
  }
  private static flexId(k: number): string {
    return `flex-${k}`;
  }
  private static tubeIds(k: number): string[] {
    const prefix = ModuleNetwork.copyPrefix(HrsRadiatorPath.panelId(k), 0);
    const n = HrsRadiatorPath.COUNTS.tubesPerPathPerPanel;
    return Array.from({ length: n }, (_, i) => `${prefix}cross-${i + 1}`);
  }

  private static expectedOf(c: HrsPublishedCounts): HrsPathCounts {
    if (c.flexHosesPerPath !== c.panelsPerOru - 1) {
      throw new Error("Published flex-hose count must be one less than the series panel count.");
    }
    return {
      panels: c.panelsPerOru,
      tubes: c.panelsPerOru * c.tubesPerPathPerPanel,
      flexHoses: c.flexHosesPerPath,
      valveModulePorts: c.portsPerValveModule,
    };
  }

  private static stationOf(c: HrsPublishedCounts): HrsStationCounts {
    const orbitalReplaceableUnits = c.wings * c.orusPerWing;
    const panels = orbitalReplaceableUnits * c.panelsPerOru;
    const paths = orbitalReplaceableUnits * c.pathsPerOru;
    const pathsPerLoop = paths / c.ammoniaLoops;
    const panelTubes = paths * c.panelsPerOru * c.tubesPerPathPerPanel;
    return { orbitalReplaceableUnits, panels, paths, pathsPerLoop, panelTubes };
  }

  private static baselineAssumptions(): HrsPathAssumptions {
    const tubes = HrsRadiatorPath.COUNTS.tubesPerPathPerPanel;
    const panelLongM = 3.33;
    const panelShortM = 2.64;
    return {
      name: "hrs-path-baseline-v1",
      tag: "NOT flight-published",
      tube: {
        D: {
          value: 0.008,
          basis: "model-assumption",
          note: "Tube inside diameter 8 mm. Model so Darcy is well-posed. Not a flight Inconel size. Not the AIAA A35030 prototype 5 mm.",
        },
        L: {
          value: panelShortM,
          basis: "published-envelope-bound",
          note: "Tube length taken as the published panel short edge 2.64 m. Tube orientation and active length are not published.",
        },
        eps: {
          value: 1.5e-6,
          basis: "model-assumption",
          note: "Drawn-tube roughness. Inconel finish is not published.",
        },
      },
      manifold: {
        D: {
          value: 0.025,
          basis: "model-assumption",
          note: "Edge-manifold inside diameter 25 mm. Model. Not the AIAA A35030 prototype 12 mm.",
        },
        pitch: {
          value: panelLongM / tubes,
          basis: "derived-from-published",
          note: "Header pitch is the published panel long edge 3.33 m divided by eleven tubes on this path. Shared 22-tube take-off spacing is not published.",
        },
      },
      flexHose: {
        D: {
          value: 0.025,
          basis: "model-assumption",
          note: "Inter-panel flex-hose inside diameter 25 mm. Model. Flight hose size is empty in the open record.",
        },
        L: {
          value: 1.0,
          basis: "model-assumption",
          note: "Flex-hose length 1 m. Model. Inter-panel hose length is not published.",
        },
        K: {
          value: 1,
          basis: "model-assumption",
          note: "Flex-hose minor-loss K = 1. Fitting K is empty in the open record.",
        },
      },
      valvePort: {
        D: {
          value: 0.025,
          basis: "model-assumption",
          note: "Radiator Beam Valve Module port diameter 25 mm. Model. Module internals are not published.",
        },
        L: {
          value: 0.3,
          basis: "model-assumption",
          note: "Port passage length 0.3 m. Model.",
        },
        K: {
          value: 2,
          basis: "model-assumption",
          note: "Fully open isolation K = 2. Bypass is not modeled.",
        },
      },
      tees: false,
    };
  }

  private static buildDescription(a: HrsPathAssumptions): string {
    return (
      "One ammonia path through one Heat Rejection Subsystem radiator Orbital Replaceable Unit: " +
      "Radiator Beam Valve Module inlet port, eight panels in series (eleven parallel Inconel flow tubes " +
      "and edge manifolds per panel), seven flex hoses, Radiator Beam Valve Module outlet port. " +
      "Hydraulic only. Diameters, lengths, and loss coefficients are assumption set " +
      `${a.name}, tagged ${a.tag}. Not International Space Station flight geometry. ` +
      "Not the AIAA A35030 prototype. Path flow is published Loop A 8200 lb/h shared over six paths " +
      "(three Orbital Replaceable Units times two paths, zero bypass). Return is the published 300 psia " +
      "pump-module inlet. Do not expect flow or pressure drop to match Active Thermal Control System " +
      "links a-rad / b-rad (lumped wings). Station scale 6 Orbital Replaceable Units, 48 panels, 12 paths, " +
      "1056 panel tubes is a count audit, not this deck. Thermal Radiator Rotary Joint Flex Hose Rotary " +
      "Coupler is out of scope."
    );
  }

  private static assertAssumptions(a: HrsPathAssumptions): void {
    if (a.tag !== "NOT flight-published") {
      throw new Error("Assumption set must be tagged NOT flight-published.");
    }
    const dims: HrsAssumed[] = [
      a.tube.D,
      a.tube.L,
      a.tube.eps,
      a.manifold.D,
      a.manifold.pitch,
      a.flexHose.D,
      a.flexHose.L,
      a.valvePort.D,
      a.valvePort.L,
    ];
    for (const d of dims) {
      if (!(Number.isFinite(d.value) && d.value > 0)) {
        throw new Error(`Assumption ${d.note} must be a positive finite number.`);
      }
    }
    for (const k of [a.flexHose.K, a.valvePort.K]) {
      if (!(Number.isFinite(k.value) && k.value >= 0)) {
        throw new Error(`Assumption ${k.note} must be a finite K ≥ 0.`);
      }
    }
  }

  private static packParams(a: HrsPathAssumptions): ChannelPackParams {
    return {
      nChannels: HrsRadiatorPath.COUNTS.tubesPerPathPerPanel,
      headerD: a.manifold.D.value,
      branchD: a.tube.D.value,
      branchL: a.tube.L.value,
      pitch: a.manifold.pitch.value,
      eps: a.tube.eps.value,
      tees: a.tees,
    };
  }

  private static flexPipe(
    k: number,
    from: string,
    to: string,
    a: HrsPathAssumptions,
  ): LinkDef {
    return {
      id: HrsRadiatorPath.flexId(k),
      name: `Inter-panel flex hose ${k}`,
      from,
      to,
      fluid: NH,
      component: {
        type: "pipe",
        lossModel: "darcy-weisbach",
        geometry: { L: a.flexHose.L.value, D: a.flexHose.D.value, eps: a.tube.eps.value },
        K: a.flexHose.K.value,
      },
    };
  }

  private static valvePort(
    which: "inlet" | "outlet",
    from: string,
    to: string,
    a: HrsPathAssumptions,
  ): LinkDef {
    const inlet = which === "inlet";
    return {
      id: inlet ? HrsRadiatorPath.RBVM_INLET_ID : HrsRadiatorPath.RBVM_OUTLET_ID,
      name: inlet
        ? "Radiator Beam Valve Module inlet port"
        : "Radiator Beam Valve Module outlet port",
      from,
      to,
      fluid: NH,
      component: {
        type: "valve",
        lossModel: "darcy-weisbach",
        geometry: { L: a.valvePort.L.value, D: a.valvePort.D.value, eps: a.tube.eps.value },
        K: a.valvePort.K.value,
        opening: 1,
      },
    };
  }

  private static panelInstance(k: number): InstanceDef {
    const lay = HrsRadiatorPath.panelLayout(k);
    return {
      id: HrsRadiatorPath.panelId(k),
      name: `Panel ${k}: eleven parallel Inconel flow tubes between edge manifolds`,
      module: HrsRadiatorPath.MODULE_ID,
      count: 1,
      ports: {
        inlet: HrsRadiatorPath.panelInletPortId(k),
        outlet: HrsRadiatorPath.panelOutletPortId(k),
      },
      x: lay.instX,
      y: lay.instY,
      fluid: NH,
    };
  }

  private static panelModule(a: HrsPathAssumptions): ModuleDef {
    return {
      id: HrsRadiatorPath.MODULE_ID,
      name: "Radiator panel: eleven parallel Inconel flow tubes between edge manifolds",
      kind: "u-manifold-pack",
      params: HrsRadiatorPath.packParams(a),
    };
  }

  private static supplyNode(): NodeDef {
    return {
      id: HrsRadiatorPath.SUPPLY_ID,
      kind: "junction",
      name: "Path supply (Loop A 8200 lb/h shared over six paths, zero bypass)",
      x: 0,
      y: EXAMPLE_PITCH_Y,
      z: 0,
      fluid: NH,
      mdotSource: HrsRadiatorPath.pathMassFlowKgS(),
    };
  }

  private static returnNode(): NodeDef {
    const c = HrsRadiatorPath.COUNTS;
    const lay = HrsRadiatorPath.panelLayout(c.panelsPerOru);
    return {
      id: HrsRadiatorPath.RETURN_ID,
      kind: "tank",
      name: "Path return (published 300 psia pump-module inlet)",
      x: lay.outX + EXAMPLE_PITCH_X,
      y: lay.y,
      z: 0,
      fluid: NH,
      pFixed: IssAtcsFigures.pumpInletPa(),
    };
  }

  private static panelLayout(k: number): {
    inX: number;
    outX: number;
    y: number;
    instX: number;
    instY: number;
  } {
    const col = (k - 1) % 4;
    const row = Math.floor((k - 1) / 4);
    const inX = EXAMPLE_PITCH_X * (1 + col * 2);
    const outX = inX + EXAMPLE_PITCH_X;
    const y = EXAMPLE_PITCH_Y * (1 + row * 3);
    return {
      inX,
      outX,
      y,
      instX: inX + EXAMPLE_PITCH_X / 2,
      instY: y + EXAMPLE_PITCH_Y / 2,
    };
  }
}

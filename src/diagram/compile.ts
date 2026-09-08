import type { Diagram, DiagramNode, PortId } from "./types";
import type {
  HexCoupling,
  LinkDef,
  NodeDef,
  Project,
  UnitPrefs,
  AnalysisSettings,
} from "../engine/types";
import { DEFAULT_CONVERGENCE, DEFAULT_UNITS } from "../engine/types";
import { AIR_25C, WATER_30C } from "../engine/fluids";

const TWO_PORT: Record<string, [PortId, PortId]> = {
  pump: ["in", "out"],
  fan: ["in", "out"],
  valve: ["in", "out"],
  filter: ["in", "out"],
  orifice: ["in", "out"],
  coldPlate: ["in", "out"],
};

function solverNodeId(node: DiagramNode, port: PortId): string {
  if (node.kind === "junction" || node.kind === "boundary" || node.kind === "tank") {
    return node.id;
  }
  if (node.kind === "heatExchanger") {
    return `${node.id}.${port}`;
  }
  return `${node.id}.${port}`;
}

function equipmentSolverNodes(n: DiagramNode): NodeDef[] {
  const base = {
    x: n.x,
    y: n.y,
    z: n.z,
    fluid: n.fluid,
  };
  if (n.kind === "boundary" || n.kind === "tank") {
    return [
      {
        id: n.id,
        kind: n.kind,
        name: n.name,
        ...base,
        pFixed: n.params.pFixed,
        tFixed: n.params.tFixed,
      },
    ];
  }
  if (n.kind === "junction") {
    return [{ id: n.id, kind: "junction", name: n.name, ...base }];
  }
  if (n.kind === "heatExchanger") {
    const ports: PortId[] = ["liqIn", "liqOut", "airIn", "airOut"];
    return ports.map((p) => ({
      id: `${n.id}.${p}`,
      kind: "junction" as const,
      name: `${n.name} ${p}`,
      x: n.x,
      y: n.y,
      z: n.z,
      fluid: p.startsWith("air") ? AIR_25C.id : n.fluid,
    }));
  }
  const [a, b] = TWO_PORT[n.kind];
  return [
    {
      id: `${n.id}.${a}`,
      kind: "junction",
      name: `${n.name} ${a}`,
      ...base,
    },
    {
      id: `${n.id}.${b}`,
      kind: "junction",
      name: `${n.name} ${b}`,
      ...base,
    },
  ];
}

function equipmentLinks(n: DiagramNode): { links: LinkDef[]; couplings: HexCoupling[] } {
  const D = n.params.D ?? 0.02;
  const L = n.params.L ?? 0;
  const eps = n.params.eps ?? 1.5e-6;
  const K = n.params.K ?? 0;

  if (n.kind === "heatExchanger") {
    const liq: LinkDef = {
      id: `${n.id}.liquid`,
      name: `${n.name} liquid`,
      from: `${n.id}.liqIn`,
      to: `${n.id}.liqOut`,
      fluid: n.fluid,
      component: {
        type: "hex-stream",
        lossModel: "darcy-weisbach",
        geometry: {
          L: n.params.liquidL ?? 0.8,
          D: n.params.liquidD ?? 0.016,
          eps,
        },
        K: n.params.liquidK ?? 6,
      },
    };
    const air: LinkDef = {
      id: `${n.id}.air`,
      name: `${n.name} air`,
      from: `${n.id}.airIn`,
      to: `${n.id}.airOut`,
      fluid: AIR_25C.id,
      component: {
        type: "hex-stream",
        lossModel: n.params.airRQuad ? "quadratic" : "darcy-weisbach",
        geometry: {
          L: n.params.airL ?? 0.06,
          D: n.params.airD ?? 0.004,
          eps: 0,
        },
        K: n.params.airK ?? 0,
        rQuad: n.params.airRQuad,
      },
    };
    const coupling: HexCoupling = {
      id: `${n.id}.hx`,
      name: n.name,
      type: "hex",
      hotLinkId: liq.id,
      coldLinkId: air.id,
      ua: n.params.ua ?? 400,
      arrangement: n.params.arrangement ?? "crossflow-unmixed",
    };
    return { links: [liq, air], couplings: [coupling] };
  }

  const pair = TWO_PORT[n.kind];
  if (!pair) return { links: [], couplings: [] };
  const [a, b] = pair;
  const type =
    n.kind === "coldPlate"
      ? "cold-plate"
      : n.kind === "pump"
        ? "pump"
        : n.kind === "fan"
          ? "fan"
          : n.kind === "valve"
            ? "valve"
            : n.kind === "filter"
              ? "filter"
              : n.kind === "orifice"
                ? "orifice"
                : "logical";

  const link: LinkDef = {
    id: `${n.id}.core`,
    name: n.name,
    from: `${n.id}.${a}`,
    to: `${n.id}.${b}`,
    fluid: n.fluid,
    component: {
      type,
      lossModel:
        n.params.lossModel ??
        (n.params.rQuad ? "quadratic" : n.params.rLin ? "linear" : "darcy-weisbach"),
      geometry: { L, D, eps, A: n.params.A },
      K,
      rQuad: n.params.rQuad,
      rLin: n.params.rLin,
      opening: n.params.opening,
      pump: n.params.pump,
      fan: n.params.fan,
      q: n.params.q,
      rTh: n.params.rTh,
    },
  };
  return { links: [link], couplings: [] };
}

export interface CompileOptions {
  units?: UnitPrefs;
  analysis?: Partial<AnalysisSettings>;
  createdAt?: string;
}

export function compileDiagram(diagram: Diagram, opts: CompileOptions = {}): Project {
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const nodes: NodeDef[] = [];
  const links: LinkDef[] = [];
  const couplings: HexCoupling[] = [];

  for (const n of diagram.nodes) {
    nodes.push(...equipmentSolverNodes(n));
    const eq = equipmentLinks(n);
    links.push(...eq.links);
    couplings.push(...eq.couplings);
  }

  for (const e of diagram.edges) {
    const a = nodeById.get(e.from.node);
    const b = nodeById.get(e.to.node);
    if (!a || !b) throw new Error(`Edge ${e.id} has a dangling end`);
    const from = solverNodeId(a, e.from.port);
    const to = solverNodeId(b, e.to.port);
    const connector = e.kind === "connector";
    const lossless = connector || (e.geometry.L === 0 && e.geometry.K === 0);
    // Connectors are layout stubs. Never inherit microchannel D from equipment.
    const D = connector ? Math.max(e.geometry.D, 0.02) : e.geometry.D;
    links.push({
      id: e.id,
      name: e.name ?? e.id,
      from,
      to,
      fluid: e.fluid,
      component: {
        type: e.kind === "duct" ? "duct" : "pipe",
        lossModel: "darcy-weisbach",
        geometry: {
          L: lossless ? 0.02 : e.geometry.L,
          D,
          eps: connector ? 0 : e.geometry.eps,
        },
        K: lossless ? 0.05 : e.geometry.K,
      },
    });
  }

  const fluids = {
    [WATER_30C.id]: WATER_30C,
    [AIR_25C.id]: AIR_25C,
    ...(diagram.fluids ?? {}),
  };
  const now = opts.createdAt ?? new Date().toISOString();

  return {
    version: "0.1.0",
    meta: {
      name: diagram.name,
      description: diagram.description,
      createdAt: now,
      updatedAt: now,
    },
    units: opts.units ?? DEFAULT_UNITS,
    fluids,
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy: true,
      gravity: true,
      convergence: {
        ...DEFAULT_CONVERGENCE,
        ...(opts.analysis?.convergence ?? {}),
      },
      ...(opts.analysis
        ? {
            type: opts.analysis.type ?? "steady",
            flowRegime: opts.analysis.flowRegime ?? "incompressible",
            energy: opts.analysis.energy ?? true,
            gravity: opts.analysis.gravity ?? true,
          }
        : {}),
    },
    nodes,
    links,
    couplings,
  };
}

import { create } from "zustand";
import type { Connection } from "@xyflow/react";
import type { Diagram, DiagramEdge, DiagramNode, EquipmentKind, PortId } from "../diagram/types";
import { compileDiagram } from "../diagram/compile";
import { solveSteady } from "../engine/solve";
import { verifySolution, type VerificationReport } from "../engine/verify";
import type { Project, SolveResult } from "../engine/types";
import { AIR_25C, WATER_30C } from "../engine/fluids";
import { EXAMPLE_CATALOG, loadExamplePayload } from "./examples/catalog";
import { diagramFingerprint, type DiagramFingerprint } from "./unsaved";

export type DockTab = "summary" | "charts" | "table" | "proof";

interface AppState {
  exampleId: string;
  /** When set, Solve uses this Project instead of compiling the canvas. */
  pinnedProject: Project | null;
  diagram: Diagram;
  baseline: DiagramFingerprint;
  project: Project | null;
  result: SolveResult | null;
  report: VerificationReport | null;
  selectedId: string | null;
  selectedKind: "node" | "edge" | null;
  solving: boolean;
  error: string | null;
  tab: DockTab;
  pendingKind: EquipmentKind | null;
  markSaved: () => void;
  loadExample: (id: string) => void;
  solve: () => void;
  select: (id: string | null, kind: "node" | "edge" | null) => void;
  moveNode: (id: string, x: number, y: number) => void;
  patchNode: (id: string, patch: Partial<DiagramNode> & { params?: DiagramNode["params"] }) => void;
  patchEdge: (id: string, patch: Partial<DiagramEdge>) => void;
  connect: (c: Connection) => void;
  addEquipment: (kind: EquipmentKind, x: number, y: number) => void;
  removeSelected: () => void;
  setTab: (tab: DockTab) => void;
  setPendingKind: (kind: EquipmentKind | null) => void;
  importJson: (text: string) => void;
  exportJson: () => string;
}

function runPinned(project: Project): Pick<AppState, "project" | "result" | "report" | "error"> {
  try {
    const result = solveSteady(project);
    const report = verifySolution(project, result);
    return { project, result, report, error: null };
  } catch (e) {
    return {
      project,
      result: null,
      report: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function runSolve(diagram: Diagram): Pick<AppState, "project" | "result" | "report" | "error"> {
  try {
    const project = compileDiagram(diagram);
    const result = solveSteady(project);
    const report = verifySolution(project, result);
    return { project, result, report, error: null };
  } catch (e) {
    return {
      project: null,
      result: null,
      report: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaults(kind: EquipmentKind): Pick<DiagramNode, "name" | "fluid" | "params"> {
  const liquid = WATER_30C.id;
  const air = AIR_25C.id;
  switch (kind) {
    case "pump":
      return {
        name: "Pump",
        fluid: liquid,
        params: { D: 0.025, K: 1, pump: { coeffs: [16, 0, -1e8] } },
      };
    case "fan":
      return {
        name: "Fan",
        fluid: air,
        params: { D: 0.12, K: 0.6, fan: { coeffs: [200, 0, -6000] } },
      };
    case "coldPlate":
      return {
        name: "Cold plate",
        fluid: liquid,
        params: { L: 0.2, D: 0.006, K: 4, q: 400, rTh: 0.05 },
      };
    case "heatExchanger":
      return {
        name: "Air–liquid HEX",
        fluid: liquid,
        params: { ua: 400, arrangement: "crossflow-unmixed", liquidK: 6, airRQuad: 4000 },
      };
    case "valve":
      return { name: "Valve", fluid: liquid, params: { D: 0.02, K: 4, opening: 1 } };
    case "filter":
      return { name: "Filter", fluid: liquid, params: { D: 0.02, L: 0.1, K: 3 } };
    case "orifice":
      return { name: "Orifice", fluid: liquid, params: { D: 0.012, K: 2.7 } };
    case "tank":
      return { name: "Tank", fluid: liquid, params: { pFixed: 151325 } };
    case "boundary":
      return { name: "Boundary", fluid: liquid, params: { pFixed: 101325, tFixed: 298.15 } };
    default:
      return { name: "Junction", fluid: liquid, params: {} };
  }
}

function clearPin() {
  return { pinnedProject: null as Project | null, exampleId: "custom" };
}

function opened(
  fields: Pick<AppState, "diagram" | "pinnedProject" | "exampleId">,
): Pick<
  AppState,
  | "exampleId"
  | "pinnedProject"
  | "diagram"
  | "baseline"
  | "selectedId"
  | "selectedKind"
  | "project"
  | "result"
  | "report"
  | "error"
> {
  const solved = fields.pinnedProject
    ? runPinned(fields.pinnedProject)
    : runSolve(fields.diagram);
  return {
    exampleId: fields.exampleId,
    pinnedProject: fields.pinnedProject,
    diagram: fields.diagram,
    baseline: diagramFingerprint(fields.diagram),
    selectedId: null,
    selectedKind: null,
    ...solved,
  };
}

const DEFAULT_EXAMPLE =
  EXAMPLE_CATALOG.find((e) => e.id === "dlc-pumped-cooling")?.id ?? EXAMPLE_CATALOG[0].id;
const initialPayload = loadExamplePayload(DEFAULT_EXAMPLE);

export const useStore = create<AppState>((set, get) => ({
  ...opened({
    exampleId: DEFAULT_EXAMPLE,
    pinnedProject: initialPayload.pinnedProject,
    diagram: initialPayload.diagram,
  }),
  solving: false,
  tab: "summary",
  pendingKind: null,

  markSaved: () => set((s) => ({ baseline: diagramFingerprint(s.diagram) })),

  loadExample: (id) => {
    const payload = loadExamplePayload(id);
    set(
      opened({
        exampleId: id,
        pinnedProject: payload.pinnedProject,
        diagram: payload.diagram,
      }),
    );
  },

  solve: () => {
    set({ solving: true });
    const { pinnedProject, diagram } = get();
    const out = pinnedProject ? runPinned(pinnedProject) : runSolve(diagram);
    set({ ...out, solving: false });
  },

  select: (id, kind) => set({ selectedId: id, selectedKind: kind }),

  moveNode: (id, x, y) =>
    set((s) => ({
      ...clearPin(),
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      },
    })),

  patchNode: (id, patch) =>
    set((s) => ({
      ...clearPin(),
      diagram: {
        ...s.diagram,
        nodes: s.diagram.nodes.map((n) =>
          n.id === id ? { ...n, ...patch, params: { ...n.params, ...patch.params } } : n,
        ),
      },
      result: null,
      report: null,
    })),

  patchEdge: (id, patch) =>
    set((s) => ({
      ...clearPin(),
      diagram: {
        ...s.diagram,
        edges: s.diagram.edges.map((e) =>
          e.id === id
            ? { ...e, ...patch, geometry: { ...e.geometry, ...(patch.geometry ?? {}) } }
            : e,
        ),
      },
      result: null,
      report: null,
    })),

  connect: (c) => {
    if (!c.source || !c.target) return;
    const src = get().diagram.nodes.find((n) => n.id === c.source);
    const fluid = src?.fluid ?? WATER_30C.id;
    const air = fluid.includes("air");
    const edge: DiagramEdge = {
      id: uid("e"),
      name: "Run",
      from: { node: c.source, port: (c.sourceHandle as PortId) ?? "out" },
      to: { node: c.target, port: (c.targetHandle as PortId) ?? "in" },
      kind: air ? "duct" : "pipe",
      fluid,
      geometry: { L: 1, D: air ? 0.12 : 0.02, eps: air ? 0 : 1.5e-6, K: 0.4 },
    };
    set((s) => ({
      ...clearPin(),
      diagram: { ...s.diagram, edges: [...s.diagram.edges, edge] },
      result: null,
      report: null,
    }));
  },

  addEquipment: (kind, x, y) => {
    const d = defaults(kind);
    const node: DiagramNode = {
      id: uid(kind),
      kind,
      name: d.name,
      x,
      y,
      z: 0,
      fluid: d.fluid,
      params: d.params,
    };
    set((s) => ({
      ...clearPin(),
      diagram: { ...s.diagram, nodes: [...s.diagram.nodes, node] },
      pendingKind: null,
      selectedId: node.id,
      selectedKind: "node",
      result: null,
      report: null,
    }));
  },

  removeSelected: () => {
    const { selectedId, selectedKind, diagram } = get();
    if (!selectedId) return;
    if (selectedKind === "edge") {
      set({
        ...clearPin(),
        diagram: { ...diagram, edges: diagram.edges.filter((e) => e.id !== selectedId) },
        selectedId: null,
        selectedKind: null,
        result: null,
        report: null,
      });
      return;
    }
    set({
      ...clearPin(),
      diagram: {
        ...diagram,
        nodes: diagram.nodes.filter((n) => n.id !== selectedId),
        edges: diagram.edges.filter((e) => e.from.node !== selectedId && e.to.node !== selectedId),
      },
      selectedId: null,
      selectedKind: null,
      result: null,
      report: null,
    });
  },

  setTab: (tab) => set({ tab }),
  setPendingKind: (kind) => set({ pendingKind: kind }),

  importJson: (text) => {
    const parsed = JSON.parse(text) as Diagram;
    if (!parsed.nodes || !parsed.edges) throw new Error("Not a hydro-flow diagram");
    set(opened({ diagram: parsed, pinnedProject: null, exampleId: "custom" }));
  },

  exportJson: () => JSON.stringify(get().diagram, null, 2),
}));

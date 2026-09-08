import type { Diagram } from "../../diagram/types";
import { projectToDiagram } from "../../diagram/projectToDiagram";
import type { Project } from "../../engine/types";
import { dlcPumpedCoolingDiagram } from "../../engine/examples/dlcPumpedCooling";

export type ExampleGroup =
  | "Getting started"
  | "Liquid cooling"
  | "Air cooling"
  | "Manifolds & cabinets";

export interface ExampleEntry {
  id: string;
  title: string;
  description: string;
  group: ExampleGroup;
  /** File under examples/, or null when the canvas diagram is hand-authored. */
  file: string | null;
}

const GROUP_ORDER: ExampleGroup[] = [
  "Getting started",
  "Liquid cooling",
  "Air cooling",
  "Manifolds & cabinets",
];

/** Curated picker list — titles assume no MacroFlow paper context. */
export const EXAMPLE_CATALOG: ExampleEntry[] = [
  {
    id: "series-pipes",
    title: "Series pipes with elevation head",
    description: "Two pipes in series lifting water 15 m.",
    group: "Getting started",
    file: "series-pipes.hydroflow.json",
  },
  {
    id: "parallel-pipes",
    title: "Two pipes in parallel",
    description: "Identical parallel pipes sharing a pressure drop.",
    group: "Getting started",
    file: "parallel-pipes.hydroflow.json",
  },
  {
    id: "pump-loop",
    title: "Pump loop with lift",
    description: "Closed loop: pump, pipe, and 15 m static head.",
    group: "Getting started",
    file: "pump-loop.hydroflow.json",
  },
  {
    id: "emitter",
    title: "Emitter to atmosphere",
    description: "Pressure-driven emitter discharging to open air.",
    group: "Getting started",
    file: "emitter.hydroflow.json",
  },
  {
    id: "dlc-pumped-cooling",
    title: "Pumped liquid cooling for a GPU rack",
    description: "CDU pump loop, four cold plates, and an air–liquid heat exchanger.",
    group: "Liquid cooling",
    file: null,
  },
  {
    id: "mf03-orifice-balance-tuned",
    title: "Parallel cold plates with orifice balancing",
    description: "Five branches; orifices steer more flow to the high-power plates.",
    group: "Liquid cooling",
    file: "mf03-orifice-balance-tuned.hydroflow.json",
  },
  {
    id: "mf03-orifice-balance-energy-tuned",
    title: "Parallel cold plates with temperatures",
    description: "Same orifice network with a simple thermal resistance on each plate.",
    group: "Liquid cooling",
    file: "mf03-orifice-balance-energy-tuned.hydroflow.json",
  },
  {
    id: "mf04-orifice-balanced",
    title: "Microchannel cold plates, orifice rebalance",
    description: "Uneven heat loads rebalanced with orifices and surface temperatures.",
    group: "Liquid cooling",
    file: "mf04-orifice-balanced.hydroflow.json",
  },
  {
    id: "mf11-lcm-table1",
    title: "Single liquid-cooling module",
    description: "One module pinned at a published operating point (flow and ΔP).",
    group: "Liquid cooling",
    file: "mf11-lcm-table1.hydroflow.json",
  },
  {
    id: "mf11-composite-expanded",
    title: "Many liquid-cooling modules in parallel",
    description: "Composite curve built from identical parallel modules.",
    group: "Liquid cooling",
    file: "mf11-composite-expanded.hydroflow.json",
  },
  {
    id: "mf01-multiplicity-chassis",
    title: "Chassis with repeated card stacks",
    description: "Shows link multiplicity collapsing four identical card paths into one link.",
    group: "Air cooling",
    file: "mf01-multiplicity-chassis.hydroflow.json",
  },
  {
    id: "mf06-altitude-sea-level",
    title: "Chassis airflow at sea level",
    description: "Published section resistances as quadratic loss; synthetic fans.",
    group: "Air cooling",
    file: "mf06-altitude-sea-level.hydroflow.json",
  },
  {
    id: "mf06-altitude-5000ft",
    title: "Chassis airflow at 5,000 ft",
    description: "Same network with density-scaled air and resistances.",
    group: "Air cooling",
    file: "mf06-altitude-5000ft.hydroflow.json",
  },
  {
    id: "mf08-bypass-balance",
    title: "Server cooling with bypass vents",
    description: "Processor path vs bypass open area (36% open case).",
    group: "Air cooling",
    file: "mf08-bypass-balance.hydroflow.json",
  },
  {
    id: "mf08-server-fan-caseB",
    title: "Server fans through chassis and PCI paths",
    description: "Synthetic fan curve plus chassis, PCI, and exhaust impedance.",
    group: "Air cooling",
    file: "mf08-server-fan-caseB.hydroflow.json",
  },
  {
    id: "mf09-heat-sink-bypass",
    title: "Heat sink with clearance bypass",
    description: "Fin channels in parallel with a clearance slot at fixed airflow.",
    group: "Air cooling",
    file: "mf09-heat-sink-bypass.hydroflow.json",
  },
  {
    id: "mf14-enclosure",
    title: "Electronics enclosure with dual fans",
    description: "EMI screen, twelve board passages, bypass, and two exhaust fans.",
    group: "Air cooling",
    file: "mf14-enclosure.hydroflow.json",
  },
  {
    id: "mf03-cold-plate-header-7_16",
    title: "Cold-plate manifold — narrow headers",
    description: "U-manifold distributing flow across seven passages (friction only).",
    group: "Manifolds & cabinets",
    file: "mf03-cold-plate-header-7_16.hydroflow.json",
  },
  {
    id: "mf03-cold-plate-header-7_16-tees",
    title: "Cold-plate manifold — narrow headers + tees",
    description: "Same manifold with sharp tee junction losses (Idelchik).",
    group: "Manifolds & cabinets",
    file: "mf03-cold-plate-header-7_16-tees.hydroflow.json",
  },
  {
    id: "mf03-cold-plate-header-7_16-gardel",
    title: "Cold-plate manifold — narrow headers + Gardel tees",
    description: "Same manifold with Gardel tee coefficients.",
    group: "Manifolds & cabinets",
    file: "mf03-cold-plate-header-7_16-gardel.hydroflow.json",
  },
  {
    id: "mf03-cold-plate-header-7_8",
    title: "Cold-plate manifold — wide headers",
    description: "Larger headers flatten the passage-to-passage flow split.",
    group: "Manifolds & cabinets",
    file: "mf03-cold-plate-header-7_8.hydroflow.json",
  },
  {
    id: "mf03-cold-plate-header-7_8-tees",
    title: "Cold-plate manifold — wide headers + tees",
    description: "Wide headers with Idelchik tee losses.",
    group: "Manifolds & cabinets",
    file: "mf03-cold-plate-header-7_8-tees.hydroflow.json",
  },
  {
    id: "mf03-cold-plate-header-7_8-gardel",
    title: "Cold-plate manifold — wide headers + Gardel tees",
    description: "Wide headers with Gardel tee coefficients.",
    group: "Manifolds & cabinets",
    file: "mf03-cold-plate-header-7_8-gardel.hydroflow.json",
  },
  {
    id: "mf13-card-cabinet-designI-friction",
    title: "Card cabinet airflow — straight ducts",
    description: "Ten card passages between supply and exhaust (friction only).",
    group: "Manifolds & cabinets",
    file: "mf13-card-cabinet-designI-friction.hydroflow.json",
  },
  {
    id: "mf13-card-cabinet-designI-tees",
    title: "Card cabinet airflow — with tee junctions",
    description: "Same cabinet with sharp tee losses at every takeoff.",
    group: "Manifolds & cabinets",
    file: "mf13-card-cabinet-designI-tees.hydroflow.json",
  },
  {
    id: "mf13-card-cabinet-designI-gardel",
    title: "Card cabinet airflow — Gardel tees",
    description: "Straight-duct cabinet with Gardel tee coefficients.",
    group: "Manifolds & cabinets",
    file: "mf13-card-cabinet-designI-gardel.hydroflow.json",
  },
  {
    id: "mf13-card-cabinet-designII-tees",
    title: "Card cabinet — tapered ducts + tees",
    description: "18° header taper intended to even out passage flow.",
    group: "Manifolds & cabinets",
    file: "mf13-card-cabinet-designII-tees.hydroflow.json",
  },
  {
    id: "mf13-card-cabinet-designII-gardel",
    title: "Card cabinet — tapered ducts + Gardel tees",
    description: "Tapered design with Gardel tee coefficients.",
    group: "Manifolds & cabinets",
    file: "mf13-card-cabinet-designII-gardel.hydroflow.json",
  },
];

const projectModules = import.meta.glob("../../../examples/*.hydroflow.json", {
  eager: true,
  import: "default",
}) as Record<string, Project>;

function projectByFile(file: string): Project {
  const key = Object.keys(projectModules).find((k) => k.endsWith(`/examples/${file}`));
  if (!key) throw new Error(`Example file not bundled: ${file}`);
  return structuredClone(projectModules[key]);
}

export function exampleGroups(): { group: ExampleGroup; entries: ExampleEntry[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    entries: EXAMPLE_CATALOG.filter((e) => e.group === group),
  }));
}

export function getExample(id: string): ExampleEntry {
  const entry = EXAMPLE_CATALOG.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown example: ${id}`);
  return entry;
}

export function loadExamplePayload(id: string): {
  entry: ExampleEntry;
  diagram: Diagram;
  /** When set, Solve uses this Project (not a recompile of the canvas). */
  pinnedProject: Project | null;
} {
  const entry = getExample(id);
  if (entry.id === "dlc-pumped-cooling" || entry.file === null) {
    const diagram = dlcPumpedCoolingDiagram();
    diagram.name = entry.title;
    diagram.description = entry.description;
    return { entry, diagram, pinnedProject: null };
  }
  const project = projectByFile(entry.file);
  project.meta = {
    ...project.meta,
    name: entry.title,
    description: entry.description,
  };
  const diagram = projectToDiagram(project, entry.title, entry.description);
  return { entry, diagram, pinnedProject: project };
}

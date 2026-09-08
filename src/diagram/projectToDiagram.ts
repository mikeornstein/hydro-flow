import type { Diagram, DiagramEdge, DiagramNode, EquipmentKind, PortId } from "./types";
import type { LinkComponent, LinkType, Project } from "../engine/types";
import { bundleSlots, EQUIP_BUNDLE_SPACING_PX, offsetAlongChord } from "./bundleOffset";

const EQUIP_KINDS: Partial<Record<LinkType, EquipmentKind>> = {
  pump: "pump",
  fan: "fan",
  valve: "valve",
  filter: "filter",
  orifice: "orifice",
  "cold-plate": "coldPlate",
};

function portFor(kind: EquipmentKind, end: "from" | "to"): PortId {
  if (kind === "junction" || kind === "boundary" || kind === "tank") return "port";
  return end === "from" ? "out" : "in";
}

function layoutScale(project: Project): { sx: number; sy: number; ox: number; oy: number } {
  const xs = project.nodes.map((n) => n.x);
  const ys = project.nodes.map((n) => n.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const targetW = 720;
  const targetH = 360;
  const sx = Math.min(8, Math.max(2.5, targetW / spanX));
  const sy = Math.min(8, Math.max(2.5, targetH / spanY));
  return { sx, sy, ox: 80 - minX * sx, oy: 60 - minY * sy };
}

function componentParams(c: LinkComponent): DiagramNode["params"] {
  return {
    L: c.geometry.L,
    D: c.geometry.D,
    eps: c.geometry.eps,
    K: c.K,
    rQuad: c.rQuad,
    rLin: c.rLin,
    opening: c.opening,
    q: c.q,
    rTh: c.rTh,
    pump: c.pump,
    fan: c.fan,
  };
}

/**
 * Canvas view of a solver Project. Equipment living on links becomes mid-edge
 * nodes. Tee / emitter / parallelCount details stay on the pinned Project used
 * for solving — this diagram is for layout and readout only.
 */
export function projectToDiagram(project: Project, title?: string, description?: string): Diagram {
  const { sx, sy, ox, oy } = layoutScale(project);
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const nodes: DiagramNode[] = project.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    name: n.name ?? n.id,
    x: n.x * sx + ox,
    y: n.y * sy + oy,
    z: n.z,
    fluid: n.fluid,
    params: { pFixed: n.pFixed, tFixed: n.tFixed },
  }));

  const edges: DiagramEdge[] = [];
  const slots = bundleSlots(
    project.links.map((l) => ({ id: l.id, from: l.from, to: l.to })),
    EQUIP_BUNDLE_SPACING_PX,
  );

  for (const link of project.links) {
    const a = byId.get(link.from);
    const b = byId.get(link.to);
    if (!a || !b) continue;
    const c = link.component;
    const equipKind = EQUIP_KINDS[c.type];
    const ax = a.x * sx + ox;
    const ay = a.y * sy + oy;
    const bx = b.x * sx + ox;
    const by = b.y * sy + oy;
    const duct = c.type === "duct" || link.fluid.includes("air");

    if (!equipKind) {
      const fromKind = a.kind;
      const toKind = b.kind;
      edges.push({
        id: link.id,
        name: link.name ?? link.id,
        from: { node: link.from, port: portFor(fromKind, "from") },
        to: { node: link.to, port: portFor(toKind, "to") },
        kind: duct ? "duct" : "pipe",
        fluid: link.fluid,
        geometry: {
          L: c.geometry.L || 0.05,
          D: c.geometry.D || 0.02,
          eps: c.geometry.eps ?? 1.5e-6,
          K: c.K ?? 0,
        },
      });
      continue;
    }

    const midId = `eq:${link.id}`;
    const mid = offsetAlongChord(
      { x: (ax + bx) / 2, y: (ay + by) / 2 },
      { x: ax, y: ay },
      { x: bx, y: by },
      slots.get(link.id)?.offset ?? 0,
    );
    nodes.push({
      id: midId,
      kind: equipKind,
      name: link.name ?? link.id,
      x: mid.x,
      y: mid.y,
      z: (a.z + b.z) / 2,
      fluid: link.fluid,
      params: componentParams(c),
      sourceLinkId: link.id,
    });
    edges.push({
      id: `${link.id}:in`,
      name: `${link.name ?? link.id} in`,
      from: { node: link.from, port: portFor(a.kind, "from") },
      to: { node: midId, port: "in" },
      kind: "connector",
      fluid: link.fluid,
      geometry: { L: 0, D: c.geometry.D || 0.02, eps: 0, K: 0 },
    });
    edges.push({
      id: `${link.id}:out`,
      name: `${link.name ?? link.id} out`,
      from: { node: midId, port: "out" },
      to: { node: link.to, port: portFor(b.kind, "to") },
      kind: "connector",
      fluid: link.fluid,
      geometry: { L: 0, D: c.geometry.D || 0.02, eps: 0, K: 0 },
    });
  }

  return {
    id: project.meta.name.toLowerCase().replace(/\s+/g, "-").slice(0, 48) || "project",
    name: title ?? project.meta.name,
    description: description ?? project.meta.description,
    nodes,
    edges,
    fluids: structuredClone(project.fluids),
  };
}

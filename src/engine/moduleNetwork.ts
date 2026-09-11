import { EXAMPLE_PITCH_X, EXAMPLE_PITCH_Y, EXAMPLE_SPAN_Y } from "./examples/canvasPitch";
import type {
  ChannelPackParams,
  LinkDef,
  ModuleDef,
  NodeDef,
  Project,
} from "./types";

export class ModuleNetwork {
  static copyPrefix(instanceId: string, copyIndex: number): string {
    return `${instanceId}#${copyIndex}:`;
  }

  static expand(project: Project): Project {
    const instances = project.instances ?? [];
    if (instances.length === 0) return project;

    const seenInst = new Set<string>();
    const modules = new Map<string, ModuleDef>();
    for (const mod of project.modules ?? []) {
      if (modules.has(mod.id)) throw new Error(`Duplicate module id ${mod.id}`);
      modules.set(mod.id, mod);
    }
    const hostNodeIds = new Set(project.nodes.map((n) => n.id));
    const hostLinkIds = new Set(project.links.map((l) => l.id));
    const out: Project = structuredClone(project);
    delete out.modules;
    delete out.instances;

    for (const inst of instances) {
      if (seenInst.has(inst.id)) throw new Error(`Duplicate instance id ${inst.id}`);
      seenInst.add(inst.id);
      const mod = modules.get(inst.module);
      if (!mod) throw new Error(`Instance ${inst.id}: unknown module ${inst.module}`);
      if (!Number.isInteger(inst.count) || inst.count < 1) {
        throw new Error(`Instance ${inst.id}: count must be an integer >= 1`);
      }
      if (!hostNodeIds.has(inst.ports.inlet)) {
        throw new Error(`Instance ${inst.id}: inlet ${inst.ports.inlet} is not a host node`);
      }
      if (!hostNodeIds.has(inst.ports.outlet)) {
        throw new Error(`Instance ${inst.id}: outlet ${inst.ports.outlet} is not a host node`);
      }
      if (!project.fluids[inst.fluid]) {
        throw new Error(`Instance ${inst.id}: unknown fluid ${inst.fluid}`);
      }
      if (mod.kind !== "u-manifold-pack") {
        throw new Error(`Module ${mod.id}: unsupported kind ${mod.kind}`);
      }
      if (!Number.isInteger(mod.params.nChannels) || mod.params.nChannels < 2) {
        throw new Error(`Module ${mod.id}: nChannels must be an integer >= 2`);
      }

      for (let i = 0; i < inst.count; i++) {
        const prefix = ModuleNetwork.copyPrefix(inst.id, i);
        const pack = ModuleNetwork.buildUManifoldPack({
          prefix,
          params: mod.params,
          fluid: inst.fluid,
          inlet: inst.ports.inlet,
          outlet: inst.ports.outlet,
          originX: inst.x,
          originY: inst.y + i * (EXAMPLE_SPAN_Y + EXAMPLE_PITCH_Y),
        });
        for (const node of pack.nodes) {
          if (hostNodeIds.has(node.id) || out.nodes.some((n) => n.id === node.id)) {
            throw new Error(`Expanded node id collides: ${node.id}`);
          }
          out.nodes.push(node);
        }
        for (const link of pack.links) {
          if (hostLinkIds.has(link.id) || out.links.some((l) => l.id === link.id)) {
            throw new Error(`Expanded link id collides: ${link.id}`);
          }
          out.links.push(link);
        }
      }
    }

    return out;
  }

  static buildUManifoldPack(args: {
    prefix: string;
    params: ChannelPackParams;
    fluid: string;
    inlet: string;
    outlet: string;
    originX: number;
    originY: number;
  }): { nodes: NodeDef[]; links: LinkDef[] } {
    const { prefix, params, fluid, inlet, outlet, originX, originY } = args;
    const n = params.nChannels;
    const { headerD, branchD, branchL, pitch, eps } = params;
    const tees = params.tees ?? false;
    const correlation = params.correlation ?? "idelchik";
    const nodes: NodeDef[] = [];
    const links: LinkDef[] = [];

    for (let i = 0; i < n; i++) {
      const tee = tees
        ? { tee: { branch: `${prefix}cross-${i + 1}`, correlation } }
        : {};
      nodes.push({
        id: `${prefix}F${i}`,
        kind: "junction",
        name: `Feed tee ${i + 1}`,
        x: originX + i * EXAMPLE_PITCH_X,
        y: originY,
        z: 0,
        fluid,
        ...tee,
      });
      nodes.push({
        id: `${prefix}C${i}`,
        kind: "junction",
        name: `Collect tee ${i + 1}`,
        x: originX + i * EXAMPLE_PITCH_X,
        y: originY + EXAMPLE_SPAN_Y,
        z: 0,
        fluid,
        ...tee,
      });
    }

    const pipe = (id: string, name: string, from: string, to: string, L: number, D: number, K: number): LinkDef => ({
      id,
      name,
      from,
      to,
      fluid,
      component: {
        type: "pipe",
        lossModel: "darcy-weisbach",
        geometry: { L, D, eps },
        K,
      },
    });

    links.push(
      pipe(`${prefix}in-F0`, "Inlet to feed", inlet, `${prefix}F0`, pitch / 2, headerD, 0.5),
    );
    for (let i = 0; i < n - 1; i++) {
      links.push(
        pipe(`${prefix}feed-${i}`, `Feed-${i + 1}`, `${prefix}F${i}`, `${prefix}F${i + 1}`, pitch, headerD, 0),
      );
    }
    for (let i = 0; i < n; i++) {
      links.push(
        pipe(
          `${prefix}cross-${i + 1}`,
          `Cross-${i + 1}`,
          `${prefix}F${i}`,
          `${prefix}C${i}`,
          branchL,
          branchD,
          0,
        ),
      );
    }
    for (let i = 0; i < n - 1; i++) {
      links.push(
        pipe(
          `${prefix}collect-${i}`,
          `Collect-${i + 1}`,
          `${prefix}C${i + 1}`,
          `${prefix}C${i}`,
          pitch,
          headerD,
          0,
        ),
      );
    }
    links.push(
      pipe(`${prefix}C0-out`, "Collect to outlet", `${prefix}C0`, outlet, pitch / 2, headerD, 0.5),
    );

    return { nodes, links };
  }
}

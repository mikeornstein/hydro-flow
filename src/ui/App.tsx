import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EquipmentNode } from "./flow/EquipmentNode";
import { FlowEdge } from "./flow/FlowEdge";
import { toFlow } from "./flow/toFlow";
import { Inspector } from "./panels/Inspector";
import { Palette } from "./panels/Palette";
import { ResultsDock } from "./panels/ResultsDock";
import { Toolbar } from "./panels/Toolbar";
import { useStore } from "./store";

const nodeTypes = { equipment: EquipmentNode };
const edgeTypes = { flow: FlowEdge };

function Canvas() {
  const diagram = useStore((s) => s.diagram);
  const exampleId = useStore((s) => s.exampleId);
  const result = useStore((s) => s.result);
  const selectedId = useStore((s) => s.selectedId);
  const moveNode = useStore((s) => s.moveNode);
  const select = useStore((s) => s.select);
  const connect = useStore((s) => s.connect);
  const pendingKind = useStore((s) => s.pendingKind);
  const addEquipment = useStore((s) => s.addEquipment);
  const removeSelected = useStore((s) => s.removeSelected);
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(
    () => toFlow(diagram, result, selectedId),
    [diagram, result, selectedId],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fitView({ padding: 0.18, duration: 220 });
    }, 30);
    return () => window.clearTimeout(t);
  }, [exampleId, diagram.id, fitView]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && ch.id) {
          moveNode(ch.id, ch.position.x, ch.position.y);
        }
      }
    },
    [moveNode],
  );

  const onConnect = useCallback((c: Connection) => connect(c), [connect]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
      onNodeClick={(_, n) => select(n.id, "node")}
      onEdgeClick={(_, e) => select(e.id, "edge")}
      onPaneClick={(ev) => {
        if (pendingKind) {
          const bounds = (ev.target as HTMLElement).closest(".react-flow")?.getBoundingClientRect();
          const x = ev.clientX - (bounds?.left ?? 0) - 80;
          const y = ev.clientY - (bounds?.top ?? 0) - 40;
          addEquipment(pendingKind, x, y);
          return;
        }
        select(null, null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Delete" || e.key === "Backspace") removeSelected();
      }}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.35}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      className={pendingKind ? "placing" : ""}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(212,165,116,0.14)" />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        maskColor="rgba(8,12,16,0.72)"
        nodeColor={(n) => {
          const kind = (n.data as { node?: { kind?: string } })?.node?.kind;
          if (kind === "coldPlate") return "#e08a4f";
          if (kind === "fan" || kind === "boundary") return "#7eb3ff";
          if (kind === "heatExchanger") return "#d4a574";
          return "#3ad7b7";
        }}
      />
    </ReactFlow>
  );
}

export function App() {
  const removeSelected = useStore((s) => s.removeSelected);
  const solve = useStore((s) => s.solve);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") removeSelected();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") solve();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeSelected, solve]);

  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <Toolbar />
        <div className="workspace">
          <Palette />
          <main className="canvas-wrap">
            <Canvas />
          </main>
          <Inspector />
        </div>
        <ResultsDock />
      </div>
    </ReactFlowProvider>
  );
}

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
import { useLayout, type LayoutMode } from "./layout/model";
import { Inspector } from "./panels/Inspector";
import { CompactHeader, MobileChrome } from "./panels/MobileChrome";
import { Palette } from "./panels/Palette";
import { ResultsDock } from "./panels/ResultsDock";
import { Toolbar } from "./panels/Toolbar";
import { useStore } from "./store";

const nodeTypes = { equipment: EquipmentNode };
const edgeTypes = { flow: FlowEdge };

export interface CanvasProps {
  layoutMode: LayoutMode;
}

function Canvas({ layoutMode }: CanvasProps) {
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
  const { fitView, screenToFlowPosition } = useReactFlow();
  const sheet = layoutMode === "sheet";
  const fitPadding = sheet ? 0.22 : 0.18;

  const { nodes, edges } = useMemo(
    () => toFlow(diagram, result, selectedId),
    [diagram, result, selectedId],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fitView({ padding: fitPadding, duration: 220 });
    }, 30);
    return () => window.clearTimeout(t);
  }, [exampleId, diagram.id, fitView, fitPadding, layoutMode]);

  useEffect(() => {
    if (!sheet) return;
    const onResize = () => {
      void fitView({ padding: fitPadding, duration: 180 });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sheet, fitView, fitPadding]);

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
          const p = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
          addEquipment(pendingKind, p.x - 80, p.y - 40);
          return;
        }
        select(null, null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Delete" || e.key === "Backspace") removeSelected();
      }}
      fitView
      fitViewOptions={{ padding: fitPadding }}
      minZoom={0.35}
      maxZoom={1.6}
      connectionRadius={sheet ? 28 : 20}
      proOptions={{ hideAttribution: true }}
      className={pendingKind ? "placing" : ""}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(212,165,116,0.14)" />
      <Controls showInteractive={false} position={sheet ? "top-left" : "bottom-left"} />
      {!sheet && (
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
      )}
    </ReactFlow>
  );
}

function AppBody() {
  const layout = useLayout();
  const removeSelected = useStore((s) => s.removeSelected);
  const solve = useStore((s) => s.solve);
  const setPendingKind = useStore((s) => s.setPendingKind);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") removeSelected();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") solve();
      if (e.key === "Escape") setPendingKind(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeSelected, solve, setPendingKind]);

  return (
    <div className="app-shell" data-layout={layout.mode}>
      {layout.mode === "sheet" ? <CompactHeader layout={layout} /> : <Toolbar />}
      <div className="workspace">
        {layout.mode === "rail" && <Palette />}
        <main className="canvas-wrap">
          <Canvas layoutMode={layout.mode} />
        </main>
        {layout.mode === "rail" && <Inspector />}
      </div>
      {layout.mode === "sheet" ? <MobileChrome layout={layout} /> : <ResultsDock />}
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <AppBody />
    </ReactFlowProvider>
  );
}

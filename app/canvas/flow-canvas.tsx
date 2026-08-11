"use client";

/**
 * FlowCanvas — React Flow based graph canvas for DeCLA.
 *
 * Phase 1: Any two stages can be connected; edges carry an optional label and color.
 * Phase 2: Decision nodes expose multiple source handles for branching.
 *
 * Layout: Dagre auto-layout runs when no stage has saved x/y coordinates.
 * Once a user drags a node, positions are persisted back to the CanvasStage array.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  getStraightPath,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition,
} from "@xyflow/react";
import dagre from "dagre";
import { StageIcon } from "@/lib/stage-icons";
import type { CanvasEdge, CanvasStage } from "@/lib/local-canvas";

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_WIDTH = 188;
const NODE_HEIGHT = 190;
const DAGRE_RANKDIR = "LR"; // left-to-right flow

// ─── Dagre auto-layout ────────────────────────────────────────────────────────

function getAutoLayout(
  rfNodes: Node[],
  rfEdges: Edge[],
): Map<string, XYPosition> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: DAGRE_RANKDIR, ranksep: 80, nodesep: 45 });

  rfNodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  rfEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const positions = new Map<string, XYPosition>();
  rfNodes.forEach((node) => {
    const { x, y } = g.node(node.id);
    positions.set(node.id, {
      x: x - NODE_WIDTH / 2,
      y: y - NODE_HEIGHT / 2,
    });
  });
  return positions;
}

// ─── Types shared with page.tsx ───────────────────────────────────────────────

export type FlowCanvasProps = {
  stages: CanvasStage[];
  edges: CanvasEdge[];
  selectedStageId: string | null;
  selectedEdgeId: string | null;
  /** User clicked a stage node */
  onSelectStage: (id: string | null) => void;
  /** User clicked an edge */
  onSelectEdge: (id: string | null) => void;
  /** Node positions changed (drag) — update stages with new x/y */
  onStagePositionsChange: (updates: { id: string; x: number; y: number }[]) => void;
  /** New edge drawn by the user */
  onEdgeCreated: (edge: CanvasEdge) => void;
  /** Edge deleted from the canvas */
  onEdgeDeleted: (id: string) => void;
  /** Add a stage button clicked */
  onAddStageRequest: () => void;
};

// ─── Custom Node ──────────────────────────────────────────────────────────────

type StageNodeData = {
  stage: CanvasStage;
  selected: boolean;
  index: number;
  total: number;
  isDecision: boolean;
};

function StageNode({ data }: NodeProps) {
  const { stage, selected, index, isDecision } = data as StageNodeData;

  if (isDecision) {
    return (
      <>
        {/* Target handle (left) */}
        <Handle type="target" position={Position.Left} id="target" className="rf-handle" />

        {/* Diamond wrapper */}
        <div
          className="flow-node-decision"
          style={{ "--node-accent": stage.color } as CSSProperties}
          data-selected={selected}
        >
          <span className="flow-node-badge">{String(index + 1).padStart(2, "0")}</span>
          <span className="flow-node-icon-wrap">
            <StageIcon
              stage={{ label: stage.name, platform: stage.platform, stage_type_key: stage.iconKey, category: stage.type }}
              decorative={false}
            />
          </span>
          <strong className="flow-node-label">{stage.name || "Untitled"}</strong>
          {stage.properties.length > 0 && (
            <span className="flow-node-props">{stage.properties.length} {stage.properties.length === 1 ? "prop" : "props"}</span>
          )}
        </div>

        {/* Source handles — right (primary) and bottom (branch) */}
        <Handle type="source" position={Position.Right} id="right" className="rf-handle rf-handle--right" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="rf-handle rf-handle--bottom" />
      </>
    );
  }

  return (
    <>
      <Handle type="target" position={Position.Left} id="target" className="rf-handle" />

      <div
        className="flow-node-rf"
        style={{ "--node-accent": stage.color } as CSSProperties}
        data-selected={selected}
      >
        <span className="flow-node-top-row">
          <small>{String(index + 1).padStart(2, "0")}</small>
          <span className="node-more">•••</span>
        </span>
        <span className="flow-node-icon-rf">
          <StageIcon
            stage={{ label: stage.name, platform: stage.platform, stage_type_key: stage.iconKey, category: stage.type }}
            decorative={false}
          />
        </span>
        <strong>{stage.name || "Untitled"}</strong>
        <span className="flow-node-meta-rf">
          <span>{stage.type}</span>
          <span>{stage.platform}</span>
        </span>
        {stage.properties.length > 0 && (
          <span className="node-property-count">{stage.properties.length} {stage.properties.length === 1 ? "property" : "properties"}</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} id="right" className="rf-handle" />
    </>
  );
}

// ─── Custom Edge ──────────────────────────────────────────────────────────────

function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const edgeData = data as { label?: string; color?: string } | undefined;
  const label = edgeData?.label;
  const color = edgeData?.color ?? "var(--edge-default)";

  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <>
      {/* Wider invisible hit area */}
      <path
        id={`${id}-hit`}
        d={edgePath}
        strokeWidth={16}
        stroke="transparent"
        fill="none"
        className="rf-edge-hitarea"
      />
      <path
        id={id}
        d={edgePath}
        strokeWidth={selected ? 2.5 : 1.8}
        stroke={selected ? "var(--primary)" : color}
        fill="none"
        markerEnd={markerEnd}
        className="rf-edge-path"
        style={style}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`rf-edge-label${selected ? " selected" : ""}`}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ─── Converters ───────────────────────────────────────────────────────────────

function stagesToRfNodes(
  stages: CanvasStage[],
  positions: Map<string, XYPosition>,
  selectedStageId: string | null,
): Node[] {
  return stages.map((stage, index) => ({
    id: stage.id,
    type: "stageNode",
    position: positions.get(stage.id) ?? { x: index * (NODE_WIDTH + 80), y: 0 },
    data: {
      stage,
      selected: stage.id === selectedStageId,
      index,
      total: stages.length,
      isDecision: stage.iconKey === "decision",
    } satisfies StageNodeData,
    width: NODE_WIDTH,
    height: stage.iconKey === "decision" ? 160 : NODE_HEIGHT,
  }));
}

function canvasEdgesToRfEdges(edges: CanvasEdge[], selectedEdgeId: string | null): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.fromStageId,
    target: edge.toStageId,
    sourceHandle: "right",
    targetHandle: "target",
    type: "labeledEdge",
    selected: edge.id === selectedEdgeId,
    data: { label: edge.label, color: edge.color },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: edge.color ?? "var(--edge-default)",
    },
  }));
}

// ─── Inner flow (needs useReactFlow) ─────────────────────────────────────────

const nodeTypes = { stageNode: StageNode };
const edgeTypes = { labeledEdge: LabeledEdge };

function FlowCanvasInner({
  stages,
  edges: canvasEdges,
  selectedStageId,
  selectedEdgeId,
  onSelectStage,
  onSelectEdge,
  onStagePositionsChange,
  onEdgeCreated,
  onEdgeDeleted,
  onAddStageRequest,
}: FlowCanvasProps) {
  const { fitView } = useReactFlow();

  // ── Derive initial positions ───────────────────────────────────────────────
  // If every stage already has x/y, use those. Otherwise auto-layout.
  const hasPositions = stages.every((s) => s.x !== undefined && s.y !== undefined);

  const initialPositions = useMemo<Map<string, XYPosition>>(() => {
    if (hasPositions) {
      return new Map(stages.map((s) => [s.id, { x: s.x!, y: s.y! }]));
    }
    // Build temp RF nodes/edges just for layout
    const tempNodes = stages.map((s, i) => ({
      id: s.id,
      type: "stageNode",
      position: { x: i * (NODE_WIDTH + 80), y: 0 },
      data: {},
    })) as Node[];
    const tempEdges = canvasEdgesToRfEdges(canvasEdges, null);
    return getAutoLayout(tempNodes, tempEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally stable on mount

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState(
    stagesToRfNodes(stages, initialPositions, selectedStageId),
  );
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState(
    canvasEdgesToRfEdges(canvasEdges, selectedEdgeId),
  );

  // ── Sync external changes → React Flow state ──────────────────────────────
  // We keep a ref of the last known stages/edges to detect external mutations
  // (e.g. add stage, rename stage from inspector) while preserving RF positions.
  const lastStagesRef = useRef(stages);
  const lastEdgesRef = useRef(canvasEdges);
  const positionsRef = useRef(initialPositions);

  useEffect(() => {
    const stagesChanged = stages !== lastStagesRef.current;
    const edgesChanged = canvasEdges !== lastEdgesRef.current;

    if (stagesChanged) {
      lastStagesRef.current = stages;
      // Preserve current positions from RF
      const currentPositions = new Map<string, XYPosition>(
        rfNodes.map((n) => [n.id, n.position]),
      );

      // Detect if any new stage appeared without a position → auto-layout
      const anyNew = stages.some((s) => !currentPositions.has(s.id) && s.x === undefined);
      let positions = currentPositions;
      if (anyNew) {
        // Merge new stages into position map then re-layout
        stages.forEach((s, i) => {
          if (!positions.has(s.id)) {
            positions.set(s.id, { x: i * (NODE_WIDTH + 80), y: 0 });
          }
        });
        const tempNodes = stages.map((s) => ({
          id: s.id,
          type: "stageNode",
          position: positions.get(s.id)!,
          data: {},
        })) as Node[];
        const tempEdges = canvasEdgesToRfEdges(canvasEdges, null);
        positions = getAutoLayout(tempNodes, tempEdges);
      }
      positionsRef.current = positions;
      setRfNodes(stagesToRfNodes(stages, positions, selectedStageId));
    } else {
      // Only selection changed
      setRfNodes((prev) =>
        prev.map((n) => ({
          ...n,
          data: { ...(n.data as object), selected: n.id === selectedStageId },
        })),
      );
    }

    if (edgesChanged) {
      lastEdgesRef.current = canvasEdges;
      setRfEdges(canvasEdgesToRfEdges(canvasEdges, selectedEdgeId));
    } else {
      setRfEdges((prev) =>
        prev.map((e) => ({ ...e, selected: e.id === selectedEdgeId })),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, canvasEdges, selectedStageId, selectedEdgeId]);

  // ── Node drag end — persist positions ─────────────────────────────────────
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onRfNodesChange(changes);
      const posUpdates: { id: string; x: number; y: number }[] = [];
      for (const change of changes) {
        if (change.type === "position" && !change.dragging && change.position) {
          posUpdates.push({ id: change.id, x: change.position.x, y: change.position.y });
        }
      }
      if (posUpdates.length > 0) onStagePositionsChange(posUpdates);
    },
    [onRfNodesChange, onStagePositionsChange],
  );

  // ── Edge changes — handle deletion ────────────────────────────────────────
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onRfEdgesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") onEdgeDeleted(change.id);
      }
    },
    [onRfEdgesChange, onEdgeDeleted],
  );

  // ── Connect handler ───────────────────────────────────────────────────────
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // Prevent self-connections and duplicate edges
      if (connection.source === connection.target) return;
      const duplicate = canvasEdges.some(
        (e) => e.fromStageId === connection.source && e.toStageId === connection.target,
      );
      if (duplicate) return;

      const newEdge: CanvasEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromStageId: connection.source,
        toStageId: connection.target,
      };
      onEdgeCreated(newEdge);

      // Optimistically update React Flow
      setRfEdges((prev) =>
        addEdge(
          {
            ...connection,
            id: newEdge.id,
            type: "labeledEdge",
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "var(--edge-default)" },
          },
          prev,
        ),
      );
    },
    [canvasEdges, onEdgeCreated, setRfEdges],
  );

  // ── Fit view on first mount ───────────────────────────────────────────────
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!fittedRef.current && stages.length > 0) {
      fittedRef.current = true;
      setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 80);
    }
  }, [fitView, stages.length]);

  if (stages.length === 0) return null;

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      onNodeClick={(_e, node) => { onSelectEdge(null); onSelectStage(node.id); }}
      onEdgeClick={(_e, edge) => { onSelectStage(null); onSelectEdge(edge.id); }}
      onPaneClick={() => { onSelectStage(null); onSelectEdge(null); }}
      minZoom={0.3}
      maxZoom={1.6}
      fitView={false}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={["Backspace", "Delete"]}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={18}
        size={0.8}
        color="var(--canvas-grid-dot)"
      />
      <Controls showInteractive={false} className="rf-controls" />
      <MiniMap
        className="rf-minimap"
        nodeColor={(n) => {
          const d = n.data as StageNodeData | undefined;
          return d?.stage?.color ?? "#4f46e5";
        }}
        maskColor="rgba(0,0,0,0.06)"
      />

      {/* "Add stage" shortcut visible in top-right */}
      <div className="rf-add-node-btn-wrap">
        <button className="rf-add-node-btn" onClick={onAddStageRequest}>
          ＋ Add stage
        </button>
      </div>
    </ReactFlow>
  );
}

// ─── Public export (wrapped in provider) ─────────────────────────────────────

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

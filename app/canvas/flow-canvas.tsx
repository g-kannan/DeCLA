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

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
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
import type { CanvasEdge, CanvasEdgeLineStyle, CanvasStage } from "@/lib/local-canvas";

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_WIDTH = 188;
const NODE_HEIGHT = 190;
const DECISION_NODE_SIZE = 210;

// ─── Dagre auto-layout ────────────────────────────────────────────────────────

export function getAutoLayout(
  stages: Pick<CanvasStage, "id" | "iconKey">[],
  edges: Pick<CanvasEdge, "id" | "fromStageId" | "toStageId">[],
  rankdir: "TB" | "LR" = "TB",
): Map<string, XYPosition> {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, ranksep: 80, nodesep: 45 });

  stages.forEach((stage) => {
    const isDecision = stage.iconKey === "decision";
    g.setNode(stage.id, {
      width: isDecision ? DECISION_NODE_SIZE : NODE_WIDTH,
      height: isDecision ? DECISION_NODE_SIZE : NODE_HEIGHT,
    });
  });
  const stageIds = new Set(stages.map((stage) => stage.id));
  edges.forEach((edge) => {
    if (stageIds.has(edge.fromStageId) && stageIds.has(edge.toStageId)) {
      g.setEdge(edge.fromStageId, edge.toStageId, {}, edge.id);
    }
  });

  dagre.layout(g);

  const positions = new Map<string, XYPosition>();
  stages.forEach((stage) => {
    const { x, y, width, height } = g.node(stage.id);
    positions.set(stage.id, {
      x: Math.round(x - width / 2),
      y: Math.round(y - height / 2),
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
  /** Global default edge line routing style (defaults to "smoothstep" L-shaped grid routing) */
  edgeLineStyle?: CanvasEdgeLineStyle;
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
        {/* Target handle — left tip of the diamond */}
        <Handle type="target" position={Position.Left} id="target" className="rf-handle" />

        {/* Wrapper sized to the diamond's visual bounding box so RF positions handles correctly */}
        <div
          className="flow-node-decision-wrap"
          data-selected={selected}
          style={{ "--node-accent": stage.color } as CSSProperties}
        >
          <div
            className="flow-node-decision"
            style={{ "--node-accent": stage.color } as CSSProperties}
            data-selected={selected}
          />
          <div className="flow-node-decision-content">
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
        </div>

        {/* Source handle — right tip */}
        <Handle type="source" position={Position.Right} id="right" className="rf-handle" />
        {/* Source handle — bottom tip (branching path) */}
        <Handle type="source" position={Position.Bottom} id="bottom" className="rf-handle" />
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
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const edgeData = data as { label?: string; color?: string; lineType?: CanvasEdgeLineStyle } | undefined;
  const label = edgeData?.label;
  const color = edgeData?.color ?? "var(--edge-default)";
  const lineType = edgeData?.lineType ?? "smoothstep";

  let edgePath = "";
  let labelX = 0;
  let labelY = 0;

  if (lineType === "step") {
    // Sharp L-shaped / step path (90-degree right angles with 0 radius)
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 0,
    });
  } else if (lineType === "straight") {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else if (lineType === "bezier") {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else {
    // Default: "smoothstep" (L-shaped orthogonal grid routing with 12px rounded turns)
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12,
    });
  }

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
    // Decision nodes use a 210×210 wrapper so handles land at the diamond tips
    width: stage.iconKey === "decision" ? DECISION_NODE_SIZE : NODE_WIDTH,
    height: stage.iconKey === "decision" ? DECISION_NODE_SIZE : NODE_HEIGHT,
  }));
}

function canvasEdgesToRfEdges(
  edges: CanvasEdge[],
  selectedEdgeId: string | null,
  globalLineStyle: CanvasEdgeLineStyle = "smoothstep",
): Edge[] {
  return edges.map((edge) => {
    const lineType = edge.lineType ?? globalLineStyle;
    return {
      id: edge.id,
      source: edge.fromStageId,
      target: edge.toStageId,
      sourceHandle: edge.fromHandle,
      targetHandle: edge.toHandle,
      type: "labeledEdge",
      selected: edge.id === selectedEdgeId,
      data: { label: edge.label, color: edge.color, lineType },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: edge.color ?? "var(--edge-default)",
      },
    };
  });
}

// ─── Connection Line Map ──────────────────────────────────────────────────────

const connectionLineTypeMap: Record<CanvasEdgeLineStyle, ConnectionLineType> = {
  smoothstep: ConnectionLineType.SmoothStep,
  step: ConnectionLineType.Step,
  straight: ConnectionLineType.Straight,
  bezier: ConnectionLineType.Bezier,
};

// ─── Inner flow (needs useReactFlow) ─────────────────────────────────────────

const nodeTypes = { stageNode: StageNode };
const edgeTypes = { labeledEdge: LabeledEdge };

function FlowCanvasInner({
  stages,
  edges: canvasEdges,
  selectedStageId,
  selectedEdgeId,
  edgeLineStyle = "smoothstep",
  onSelectStage,
  onSelectEdge,
  onStagePositionsChange,
  onEdgeCreated,
  onEdgeDeleted,
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
    return getAutoLayout(stages, canvasEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally stable on mount

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState(
    stagesToRfNodes(stages, initialPositions, selectedStageId),
  );
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState(
    canvasEdgesToRfEdges(canvasEdges, selectedEdgeId, edgeLineStyle),
  );

  // ── Sync external changes → React Flow state ──────────────────────────────
  // We keep a ref of the last known stages/edges to detect external mutations
  // (e.g. add stage, rename stage from inspector) while preserving RF positions.
  const lastStagesRef = useRef(stages);
  const lastEdgesRef = useRef(canvasEdges);
  useEffect(() => {
    const stagesChanged = stages !== lastStagesRef.current;
    const edgesChanged = canvasEdges !== lastEdgesRef.current;

    if (stagesChanged) {
      const previousStages = new Map(lastStagesRef.current.map((stage) => [stage.id, stage]));
      lastStagesRef.current = stages;
      // Preserve current positions from RF
      const currentPositions = new Map<string, XYPosition>(
        rfNodes.map((n) => [n.id, n.position]),
      );
      let shouldFitView = false;

      // Honor coordinates changed by an external action such as Auto arrange.
      // A drag already updates rfNodes, so it does not trigger another fit.
      for (const stage of stages) {
        const previous = previousStages.get(stage.id);
        const current = currentPositions.get(stage.id);
        const x = stage.x;
        const y = stage.y;
        const coordinatesChanged =
          x !== undefined &&
          y !== undefined &&
          (previous?.x !== x || previous?.y !== y);

        if (coordinatesChanged && x !== undefined && y !== undefined) {
          currentPositions.set(stage.id, { x, y });
          if (!current || current.x !== x || current.y !== y) {
            shouldFitView = true;
          }
        }
      }

      // Detect if any new stage appeared without a position
      const anyNew = stages.some((s) => !currentPositions.has(s.id) && s.x === undefined);
      let positions = currentPositions;
      if (anyNew) {
        if (currentPositions.size === 0) {
          positions = getAutoLayout(stages, canvasEdges);
        } else {
          const newPositions = new Map(currentPositions);
          stages.forEach((s, idx) => {
            if (!newPositions.has(s.id)) {
              const prevStage = idx > 0 ? stages[idx - 1] : undefined;
              const prevPos = prevStage ? newPositions.get(prevStage.id) : undefined;
              const prevWidth = prevStage?.iconKey === "decision" ? DECISION_NODE_SIZE : NODE_WIDTH;
              const x = s.x ?? (prevPos ? prevPos.x + prevWidth + 70 : idx * (NODE_WIDTH + 80));
              const y = s.y ?? (prevPos ? prevPos.y : 0);
              newPositions.set(s.id, { x, y });
            }
          });
          positions = newPositions;
        }
        shouldFitView = true;
      }
      setRfNodes(stagesToRfNodes(stages, positions, selectedStageId));
      if (shouldFitView) {
        setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 0);
      }
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
      setRfEdges(canvasEdgesToRfEdges(canvasEdges, selectedEdgeId, edgeLineStyle));
    } else {
      setRfEdges(canvasEdgesToRfEdges(canvasEdges, selectedEdgeId, edgeLineStyle));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, canvasEdges, selectedStageId, selectedEdgeId, edgeLineStyle]);

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
        fromHandle: connection.sourceHandle ?? undefined,
        toHandle: connection.targetHandle ?? undefined,
      };
      onEdgeCreated(newEdge);

      // Optimistically update React Flow
      setRfEdges((prev) =>
        addEdge(
          {
            ...connection,
            id: newEdge.id,
            type: "labeledEdge",
            data: { lineType: edgeLineStyle },
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "var(--edge-default)" },
          },
          prev,
        ),
      );
    },
    [canvasEdges, edgeLineStyle, onEdgeCreated, setRfEdges],
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
      connectionLineType={connectionLineTypeMap[edgeLineStyle]}
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

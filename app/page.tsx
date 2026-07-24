"use client";

import { useCallback, useMemo, useState } from "react";
import { toPng } from "html-to-image";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type StageKind = "source" | "ingest" | "store" | "transform" | "serve" | "consume";
type StageData = {
  kind: StageKind;
  label: string;
  platform: string;
  latency: number;
  cost: number;
};
type StageNode = Node<StageData, "stage">;

const catalog: Array<{ kind: StageKind; label: string; platform: string; icon: string }> = [
  { kind: "source", label: "Data source", platform: "PostgreSQL", icon: "DB" },
  { kind: "ingest", label: "Ingestion", platform: "Airflow", icon: "→" },
  { kind: "store", label: "Storage", platform: "Databricks", icon: "◇" },
  { kind: "transform", label: "Transform", platform: "dbt", icon: "⌁" },
  { kind: "serve", label: "Semantic layer", platform: "Snowflake", icon: "▦" },
  { kind: "consume", label: "Consumption", platform: "Power BI", icon: "▥" },
];

const kindLabels: Record<StageKind, string> = {
  source: "SOURCE",
  ingest: "INGEST",
  store: "STORE",
  transform: "TRANSFORM",
  serve: "SERVE",
  consume: "CONSUME",
};

const initialNodes: StageNode[] = [
  { id: "1", type: "stage", position: { x: 40, y: 160 }, data: { kind: "source", label: "Order events", platform: "PostgreSQL", latency: 1, cost: 180 } },
  { id: "2", type: "stage", position: { x: 290, y: 160 }, data: { kind: "ingest", label: "Extract & load", platform: "Airflow", latency: 8, cost: 460 } },
  { id: "3", type: "stage", position: { x: 540, y: 160 }, data: { kind: "store", label: "Lakehouse", platform: "Databricks", latency: 5, cost: 1680 } },
  { id: "4", type: "stage", position: { x: 790, y: 160 }, data: { kind: "transform", label: "Revenue model", platform: "dbt", latency: 12, cost: 920 } },
  { id: "5", type: "stage", position: { x: 1040, y: 160 }, data: { kind: "serve", label: "Finance semantic", platform: "Snowflake", latency: 3, cost: 1240 } },
  { id: "6", type: "stage", position: { x: 1290, y: 160 }, data: { kind: "consume", label: "Executive P&L", platform: "Power BI", latency: 15, cost: 680 } },
];

const initialEdges: Edge[] = initialNodes.slice(0, -1).map((node, index) => ({
  id: `e-${node.id}-${initialNodes[index + 1].id}`,
  source: node.id,
  target: initialNodes[index + 1].id,
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#7c8780" },
  style: { stroke: "#7c8780", strokeWidth: 1.5 },
}));

function StageCard({ data, selected }: NodeProps<StageNode>) {
  const preset = catalog.find((item) => item.kind === data.kind);
  return (
    <article className={`flow-stage ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="stage-top">
        <span className={`node-icon ${data.kind}`}>{preset?.icon}</span>
        <span className="kind">{kindLabels[data.kind]}</span>
        <span className="drag-dots">•••</span>
      </div>
      <strong>{data.label}</strong>
      <span className="platform">{data.platform}</span>
      <div className="node-metrics">
        <span><small>LATENCY</small><b>{data.latency} min</b></span>
        <span><small>MONTHLY</small><b>${data.cost.toLocaleString()}</b></span>
      </div>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}

const nodeTypes = { stage: StageCard };

function DecisionCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<StageNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>("3");
  const [projectName, setProjectName] = useState("Finance Revenue Pulse");
  const [latencyTarget, setLatencyTarget] = useState(30);
  const [monthlyBudget, setMonthlyBudget] = useState(4500);
  const [exportState, setExportState] = useState<"idle" | "png" | "copied">("idle");

  const totalLatency = useMemo(() => nodes.reduce((sum, node) => sum + node.data.latency, 0), [nodes]);
  const totalCost = useMemo(() => nodes.reduce((sum, node) => sum + node.data.cost, 0), [nodes]);
  const latencyVariance = totalLatency - latencyTarget;
  const budgetVariance = totalCost - monthlyBudget;
  const activeNode = nodes.find((node) => node.id === selectedId);
  const slowest = nodes.length ? nodes.reduce((a, b) => (a.data.latency > b.data.latency ? a : b)) : null;
  const costliest = nodes.length ? nodes.reduce((a, b) => (a.data.cost > b.data.cost ? a : b)) : null;

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#176b48" },
            style: { stroke: "#176b48", strokeWidth: 1.7 },
          },
          current,
        ),
      ),
    [setEdges],
  );

  const addNode = (preset: (typeof catalog)[number]) => {
    const id = String(Date.now());
    const maxX = nodes.length ? Math.max(...nodes.map((node) => node.position.x)) : 40;
    setNodes((current) => [
      ...current,
      {
        id,
        type: "stage",
        position: { x: maxX + 250, y: 160 },
        data: { kind: preset.kind, label: preset.label, platform: preset.platform, latency: 5, cost: 250 },
      },
    ]);
    setSelectedId(id);
  };

  const updateNode = (patch: Partial<StageData>) => {
    if (!selectedId) return;
    setNodes((current) =>
      current.map((node) => (node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node)),
    );
  };

  const deleteNode = () => {
    if (!selectedId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId(null);
  };

  const resetCanvas = () => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedId("3");
    setLatencyTarget(30);
    setMonthlyBudget(4500);
  };

  const downloadPng = async () => {
    const canvas = document.querySelector<HTMLElement>(".flow-area");
    if (!canvas) return;
    setExportState("png");
    try {
      const dataUrl = await toPng(canvas, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f7f7fc",
      });
      const link = document.createElement("a");
      link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "decla-canvas"}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExportState("idle");
    }
  };

  const copyMarkdown = async () => {
    const nodeName = new Map(nodes.map((node) => [node.id, node.data.label]));
    const stageRows = nodes
      .map((node) => `| ${node.data.label} | ${kindLabels[node.data.kind]} | ${node.data.platform} | ${node.data.latency} min | $${node.data.cost.toLocaleString()} |`)
      .join("\n");
    const connections = edges
      .map((edge) => `- ${nodeName.get(edge.source) ?? edge.source} → ${nodeName.get(edge.target) ?? edge.target}`)
      .join("\n");
    const markdown = `# ${projectName}

## Decision Latency Intelligence

| Guardrail | Target | Current | Variance |
|---|---:|---:|---:|
| Required freshness | ${latencyTarget} min | ${totalLatency} min | ${latencyVariance > 0 ? "+" : ""}${latencyVariance} min |
| Monthly decision budget | $${monthlyBudget.toLocaleString()} | $${totalCost.toLocaleString()} | ${budgetVariance > 0 ? "+" : budgetVariance < 0 ? "−" : ""}$${Math.abs(budgetVariance).toLocaleString()} |

## Architecture stages

| Stage | Type | Platform | Latency | Monthly cost |
|---|---|---|---:|---:|
${stageRows}

## Connections

${connections || "_No connections_"}
`;
    await navigator.clipboard.writeText(markdown);
    setExportState("copied");
    window.setTimeout(() => setExportState("idle"), 1800);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <div><strong>DeCLA</strong><small>Decision Latency Intelligence</small></div>
        </div>
        <div className="project-title">
          <span className="status-dot" />
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Project name" />
          <span className="draft">DRAFT</span>
        </div>
        <div className="top-actions">
          <button className="ghost-button" onClick={resetCanvas}>Reset</button>
          <button className="export-button" onClick={copyMarkdown}><span>⧉</span>{exportState === "copied" ? "Copied" : "Copy Markdown"}</button>
          <button className="share-button" onClick={downloadPng}><span>↓</span>{exportState === "png" ? "Exporting…" : "Download PNG"}</button>
          <div className="avatar">KG</div>
        </div>
      </header>

      <section className="guardrails">
        <div className="guardrail-intro">
          <span>PROJECT TARGETS</span>
          <strong>Decision guardrails</strong>
          <small>Architecture measured live</small>
        </div>
        <label className="goal-field">
          <span>Required freshness</span>
          <div><input type="number" min="1" value={latencyTarget} onChange={(event) => setLatencyTarget(Number(event.target.value))} /><b>min</b></div>
          <small>Source update → decision ready</small>
        </label>
        <div className={`variance-card ${latencyVariance > 0 ? "over" : "within"}`}>
          <span>Latency variance</span>
          <strong>{latencyVariance > 0 ? "+" : ""}{latencyVariance} min</strong>
          <small>{latencyVariance > 0 ? `${slowest?.data.label} is the largest delay` : "Architecture meets freshness target"}</small>
        </div>
        <label className="goal-field">
          <span>Monthly decision budget</span>
          <div className="budget-input"><b>$</b><input type="number" min="0" step="100" value={monthlyBudget} onChange={(event) => setMonthlyBudget(Number(event.target.value))} /></div>
          <small>Maximum approved run cost</small>
        </label>
        <div className={`variance-card ${budgetVariance > 0 ? "over" : "within"}`}>
          <span>Budget variance</span>
          <strong>{budgetVariance > 0 ? "+" : budgetVariance < 0 ? "−" : ""}${Math.abs(budgetVariance).toLocaleString()}</strong>
          <small>{budgetVariance > 0 ? `${costliest?.data.label} drives ${totalCost ? Math.round((costliest!.data.cost / totalCost) * 100) : 0}% of cost` : `${Math.abs(budgetVariance).toLocaleString()} headroom remaining`}</small>
        </div>
      </section>

      <section className="summary-strip">
        <div className="summary-intro"><span>LIVE PATH</span><strong>Source → decision</strong></div>
        <div className="metric"><span>Current latency</span><strong>{totalLatency} min</strong><small>{latencyTarget ? Math.round((totalLatency / latencyTarget) * 100) : 0}% of target</small></div>
        <div className="metric"><span>Current monthly cost</span><strong>${totalCost.toLocaleString()}</strong><small>{monthlyBudget ? Math.round((totalCost / monthlyBudget) * 100) : 0}% of budget</small></div>
        <div className="metric"><span>Architecture</span><strong>{nodes.length} stages</strong><small>{edges.length} connected decisions</small></div>
      </section>

      <div className="workspace">
        <aside className="library">
          <div className="library-heading"><span>BUILDING BLOCKS</span><button aria-label="Collapse library">‹</button></div>
          <p>Add a prebuilt stage, then connect it.</p>
          <div className="catalog">
            {catalog.map((item) => (
              <button key={item.kind} className="catalog-item" onClick={() => addNode(item)}>
                <span className={`catalog-icon ${item.kind}`}>{item.icon}</span>
                <span><strong>{item.label}</strong><small>{item.platform}</small></span>
                <b>+</b>
              </button>
            ))}
          </div>
          <div className="library-note"><span>CANVAS CONTROLS</span>Drag to move stages. Drag a stage handle to connect. Scroll to zoom and drag empty space to pan.</div>
        </aside>

        <section className="flow-area" aria-label="Architecture decision canvas">
          <div className="flow-caption">
            <span>FLOW 01</span>
            <strong>Executive revenue decision path</strong>
            <small>Connect stages to describe how data becomes a decision</small>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.35}
            maxZoom={1.8}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#cbd1ca" gap={20} size={1} />
            <Controls showInteractive={false} position="top-center" />
            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeColor={(node) => node.id === selectedId ? "#176b48" : "#a9b2ac"}
              maskColor="rgba(247,247,243,.75)"
            />
          </ReactFlow>
        </section>

        {activeNode && (
          <aside className="inspector">
            <div className="inspector-heading">
              <div><span>STAGE DETAILS</span><strong>{kindLabels[activeNode.data.kind]}</strong></div>
              <button onClick={() => setSelectedId(null)} aria-label="Close panel">×</button>
            </div>
            <label>Stage name<input value={activeNode.data.label} onChange={(event) => updateNode({ label: event.target.value })} /></label>
            <label>
              Platform
              <select value={activeNode.data.platform} onChange={(event) => updateNode({ platform: event.target.value })}>
                {["PostgreSQL", "Kafka", "Airflow", "Databricks", "Snowflake", "dbt", "Fabric", "BigQuery", "Power BI", "Tableau"].map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <div className="field-grid">
              <label>Latency (min)<input type="number" min="0" value={activeNode.data.latency} onChange={(event) => updateNode({ latency: Number(event.target.value) })} /></label>
              <label>Cost / month<div className="money-input"><span>$</span><input type="number" min="0" value={activeNode.data.cost} onChange={(event) => updateNode({ cost: Number(event.target.value) })} /></div></label>
            </div>
            <div className="contribution-block">
              <div><span>LATENCY SHARE</span><strong>{totalLatency ? Math.round((activeNode.data.latency / totalLatency) * 100) : 0}%</strong></div>
              <div className="progress"><i style={{ width: `${totalLatency ? (activeNode.data.latency / totalLatency) * 100 : 0}%` }} /></div>
              <div><span>BUDGET SHARE</span><strong>{monthlyBudget ? Math.round((activeNode.data.cost / monthlyBudget) * 100) : 0}%</strong></div>
              <div className="progress cost"><i style={{ width: `${Math.min(100, monthlyBudget ? (activeNode.data.cost / monthlyBudget) * 100 : 0)}%` }} /></div>
            </div>
            <label>Context note<textarea defaultValue="Business-critical stage for the executive finance review. Runs every 30 minutes." /></label>
            <button className="delete-button" onClick={deleteNode}>Remove stage</button>
          </aside>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return <ReactFlowProvider><DecisionCanvas /></ReactFlowProvider>;
}

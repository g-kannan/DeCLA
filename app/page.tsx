"use client";

import { useMemo, useState } from "react";

type NodeKind = "source" | "ingest" | "store" | "transform" | "serve" | "consume";

type CanvasNode = {
  id: number;
  kind: NodeKind;
  label: string;
  platform: string;
  latency: number;
  cost: number;
  x: number;
  y: number;
};

const catalog: Array<{ kind: NodeKind; label: string; platform: string; icon: string }> = [
  { kind: "source", label: "Data source", platform: "PostgreSQL", icon: "DB" },
  { kind: "ingest", label: "Ingestion", platform: "Airflow", icon: "→" },
  { kind: "store", label: "Storage", platform: "Databricks", icon: "◇" },
  { kind: "transform", label: "Transform", platform: "dbt", icon: "⌁" },
  { kind: "serve", label: "Semantic layer", platform: "Snowflake", icon: "▦" },
  { kind: "consume", label: "Consumption", platform: "Power BI", icon: "▥" },
];

const initialNodes: CanvasNode[] = [
  { id: 1, kind: "source", label: "Order events", platform: "PostgreSQL", latency: 1, cost: 180, x: 70, y: 220 },
  { id: 2, kind: "ingest", label: "Extract & load", platform: "Airflow", latency: 8, cost: 460, x: 320, y: 220 },
  { id: 3, kind: "store", label: "Lakehouse", platform: "Databricks", latency: 5, cost: 1680, x: 570, y: 220 },
  { id: 4, kind: "transform", label: "Revenue model", platform: "dbt", latency: 12, cost: 920, x: 820, y: 220 },
  { id: 5, kind: "serve", label: "Finance semantic", platform: "Snowflake", latency: 3, cost: 1240, x: 1070, y: 220 },
  { id: 6, kind: "consume", label: "Executive P&L", platform: "Power BI", latency: 15, cost: 680, x: 1320, y: 220 },
];

const kindLabels: Record<NodeKind, string> = {
  source: "SOURCE",
  ingest: "INGEST",
  store: "STORE",
  transform: "TRANSFORM",
  serve: "SERVE",
  consume: "CONSUME",
};

export default function Home() {
  const [nodes, setNodes] = useState(initialNodes);
  const [selected, setSelected] = useState<number | null>(3);
  const [showPanel, setShowPanel] = useState(true);
  const [projectName, setProjectName] = useState("Finance Revenue Pulse");

  const totalLatency = useMemo(() => nodes.reduce((sum, node) => sum + node.latency, 0), [nodes]);
  const totalCost = useMemo(() => nodes.reduce((sum, node) => sum + node.cost, 0), [nodes]);
  const activeNode = nodes.find((node) => node.id === selected);

  const addNode = (preset: (typeof catalog)[number]) => {
    const maxX = nodes.length ? Math.max(...nodes.map((node) => node.x)) : 70;
    const id = Date.now();
    setNodes((current) => [
      ...current,
      { id, kind: preset.kind, label: preset.label, platform: preset.platform, latency: 5, cost: 250, x: maxX + 250, y: 220 },
    ]);
    setSelected(id);
    setShowPanel(true);
  };

  const updateNode = (patch: Partial<CanvasNode>) => {
    if (selected === null) return;
    setNodes((current) => current.map((node) => (node.id === selected ? { ...node, ...patch } : node)));
  };

  const deleteNode = () => {
    if (selected === null) return;
    setNodes((current) => current.filter((node) => node.id !== selected));
    setSelected(null);
    setShowPanel(false);
  };

  const startDrag = (event: React.PointerEvent, node: CanvasNode) => {
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = node.x;
    const startY = node.y;
    event.currentTarget.setPointerCapture(event.pointerId);

    const move = (moveEvent: React.PointerEvent) => {
      setNodes((current) =>
        current.map((item) =>
          item.id === node.id
            ? { ...item, x: Math.max(20, startX + moveEvent.clientX - originX), y: Math.max(80, startY + moveEvent.clientY - originY) }
            : item,
        ),
      );
    };
    const stop = (upEvent: React.PointerEvent) => {
      upEvent.currentTarget.releasePointerCapture(upEvent.pointerId);
      upEvent.currentTarget.removeEventListener("pointermove", move as never);
      upEvent.currentTarget.removeEventListener("pointerup", stop as never);
    };
    event.currentTarget.addEventListener("pointermove", move as never);
    event.currentTarget.addEventListener("pointerup", stop as never);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <div>
            <strong>DeCLA</strong>
            <small>Decision Canvas</small>
          </div>
        </div>
        <div className="project-title">
          <span className="status-dot" />
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Project name" />
          <span className="draft">DRAFT</span>
        </div>
        <div className="top-actions">
          <button className="ghost-button" onClick={() => setNodes(initialNodes)}>Reset</button>
          <button className="share-button">Share canvas</button>
          <div className="avatar">KG</div>
        </div>
      </header>

      <section className="summary-strip">
        <div className="summary-intro">
          <span>Source → consumption</span>
          <strong>Decision path at a glance</strong>
        </div>
        <div className="metric">
          <span>Total latency</span>
          <strong>{totalLatency} min</strong>
          <small className={totalLatency > 30 ? "warning" : "healthy"}>{totalLatency > 30 ? "Above 30 min target" : "Within target"}</small>
        </div>
        <div className="metric">
          <span>Monthly run cost</span>
          <strong>${totalCost.toLocaleString()}</strong>
          <small>$0.12 per decision</small>
        </div>
        <div className="metric">
          <span>Pipeline stages</span>
          <strong>{nodes.length}</strong>
          <small>{new Set(nodes.map((node) => node.platform)).size} platforms</small>
        </div>
        <div className="metric insight">
          <span>Biggest delay</span>
          <strong>{nodes.length ? nodes.reduce((a, b) => (a.latency > b.latency ? a : b)).label : "—"}</strong>
          <small>{nodes.length ? Math.max(...nodes.map((node) => node.latency)) : 0} min</small>
        </div>
      </section>

      <div className="workspace">
        <aside className="library">
          <div className="library-heading">
            <span>BUILDING BLOCKS</span>
            <button aria-label="Collapse library">‹</button>
          </div>
          <p>Add a stage to the decision path</p>
          <div className="catalog">
            {catalog.map((item) => (
              <button key={item.kind} className="catalog-item" onClick={() => addNode(item)}>
                <span className={`catalog-icon ${item.kind}`}>{item.icon}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.platform}</small>
                </span>
                <b>+</b>
              </button>
            ))}
          </div>
          <div className="library-note">
            <span>TIP</span>
            Drag stages to rearrange the architecture. Select one to edit its latency and cost.
          </div>
        </aside>

        <section className="canvas-wrap" aria-label="Architecture decision canvas">
          <div className="canvas-toolbar">
            <button title="Select" className="active">↖</button>
            <button title="Add note">T</button>
            <span />
            <button title="Zoom out">−</button>
            <small>100%</small>
            <button title="Zoom in">+</button>
          </div>
          <div className="canvas">
            <svg className="connections" width="1700" height="720" aria-hidden="true">
              {nodes.slice(0, -1).map((node, index) => {
                const next = nodes[index + 1];
                return (
                  <g key={`${node.id}-${next.id}`}>
                    <path
                      d={`M ${node.x + 188} ${node.y + 75} C ${node.x + 220} ${node.y + 75}, ${next.x - 30} ${next.y + 75}, ${next.x} ${next.y + 75}`}
                    />
                    <circle cx={node.x + 210} cy={node.y + 75} r="13" />
                    <text x={node.x + 210} y={node.y + 79}>{next.latency}m</text>
                  </g>
                );
              })}
            </svg>
            {nodes.map((node) => (
              <article
                key={node.id}
                className={`stage-card ${selected === node.id ? "selected" : ""}`}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                onPointerDown={(event) => startDrag(event, node)}
                onClick={() => { setSelected(node.id); setShowPanel(true); }}
              >
                <div className="stage-top">
                  <span className={`node-icon ${node.kind}`}>{catalog.find((item) => item.kind === node.kind)?.icon}</span>
                  <span className="kind">{kindLabels[node.kind]}</span>
                  <button aria-label="Node menu">•••</button>
                </div>
                <strong>{node.label}</strong>
                <span className="platform">{node.platform}</span>
                <div className="node-metrics">
                  <span><small>LATENCY</small><b>{node.latency} min</b></span>
                  <span><small>MONTHLY</small><b>${node.cost.toLocaleString()}</b></span>
                </div>
              </article>
            ))}
            <div className="canvas-caption">
              <span>FLOW 01</span>
              <strong>Executive revenue decision path</strong>
              <small>Last edited just now</small>
            </div>
          </div>
        </section>

        {showPanel && activeNode && (
          <aside className="inspector">
            <div className="inspector-heading">
              <div>
                <span>STAGE DETAILS</span>
                <strong>{kindLabels[activeNode.kind]}</strong>
              </div>
              <button onClick={() => setShowPanel(false)} aria-label="Close panel">×</button>
            </div>
            <label>
              Stage name
              <input value={activeNode.label} onChange={(event) => updateNode({ label: event.target.value })} />
            </label>
            <label>
              Platform
              <select value={activeNode.platform} onChange={(event) => updateNode({ platform: event.target.value })}>
                {["PostgreSQL", "Kafka", "Airflow", "Databricks", "Snowflake", "dbt", "Fabric", "BigQuery", "Power BI", "Tableau"].map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <div className="field-grid">
              <label>
                Latency (min)
                <input type="number" min="0" value={activeNode.latency} onChange={(event) => updateNode({ latency: Number(event.target.value) })} />
              </label>
              <label>
                Cost / month
                <div className="money-input"><span>$</span><input type="number" min="0" value={activeNode.cost} onChange={(event) => updateNode({ cost: Number(event.target.value) })} /></div>
              </label>
            </div>
            <div className="cost-callout">
              <span>STAGE CONTRIBUTION</span>
              <strong>{totalCost ? Math.round((activeNode.cost / totalCost) * 100) : 0}% of total cost</strong>
              <div><i style={{ width: `${totalCost ? (activeNode.cost / totalCost) * 100 : 0}%` }} /></div>
            </div>
            <label>
              Context note
              <textarea defaultValue="Business-critical stage for the executive finance review. Runs every 30 minutes." />
            </label>
            <button className="delete-button" onClick={deleteNode}>Remove stage</button>
          </aside>
        )}
      </div>
    </main>
  );
}

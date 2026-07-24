"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  getNodesBounds,
  getViewportForBounds,
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
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type StageKind = "source" | "ingest" | "store" | "transform" | "serve" | "consume";
type StageData = {
  kind: StageKind;
  label: string;
  platform: string;
  latency: number;
  cost: number;
  note: string;
};
type StageNode = Node<StageData, "stage">;
type SavedProject = {
  id: string;
  name: string;
  latencyTarget: number;
  monthlyBudget: number;
  nodes: StageNode[];
  edges: Edge[];
};

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
  { id: "1", type: "stage", position: { x: 40, y: 160 }, data: { kind: "source", label: "Order events", platform: "PostgreSQL", latency: 1, cost: 180, note: "Operational order events captured at source." } },
  { id: "2", type: "stage", position: { x: 290, y: 160 }, data: { kind: "ingest", label: "Extract & load", platform: "Airflow", latency: 8, cost: 460, note: "Scheduled extraction and load orchestration." } },
  { id: "3", type: "stage", position: { x: 540, y: 160 }, data: { kind: "store", label: "Lakehouse", platform: "Databricks", latency: 5, cost: 1680, note: "Business-critical stage for the executive finance review." } },
  { id: "4", type: "stage", position: { x: 790, y: 160 }, data: { kind: "transform", label: "Revenue model", platform: "dbt", latency: 12, cost: 920, note: "Curates finance-ready revenue measures." } },
  { id: "5", type: "stage", position: { x: 1040, y: 160 }, data: { kind: "serve", label: "Finance semantic", platform: "Snowflake", latency: 3, cost: 1240, note: "Governed semantic model for finance consumers." } },
  { id: "6", type: "stage", position: { x: 1290, y: 160 }, data: { kind: "consume", label: "Executive P&L", platform: "Power BI", latency: 15, cost: 680, note: "Executive dashboard reviewed throughout the day." } },
];

const initialEdges: Edge[] = initialNodes.slice(0, -1).map((node, index) => ({
  id: `e-${node.id}-${initialNodes[index + 1].id}`,
  source: node.id,
  target: initialNodes[index + 1].id,
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#2A2ACF" },
  style: { stroke: "#2A2ACF", strokeWidth: 1.6 },
}));

function StageCard({ id, data, selected }: NodeProps<StageNode>) {
  const preset = catalog.find((item) => item.kind === data.kind);
  const { updateNodeData } = useReactFlow<StageNode>();
  return (
    <article className={`flow-stage ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="stage-top">
        <span className={`node-icon ${data.kind}`}>{preset?.icon}</span>
        <span className="kind">{kindLabels[data.kind]}</span>
        <span className="drag-dots">•••</span>
      </div>
      <input
        className="node-name nodrag"
        value={data.label}
        onChange={(event) => updateNodeData(id, { label: event.target.value })}
        aria-label="Stage name"
      />
      <input
        className="platform nodrag"
        value={data.platform}
        onChange={(event) => updateNodeData(id, { platform: event.target.value })}
        aria-label="Platform name"
      />
      <div className="node-metrics">
        <span><small>LATENCY</small><b>{data.latency} min</b></span>
        <span><small>MONTHLY</small><b>${data.cost.toLocaleString()}</b></span>
      </div>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}

const nodeTypes = { stage: StageCard };
const storageKey = "decla-decision-canvas-v1";
const projectsStorageKey = "decla-projects-v2";
const createDefaultProject = (id: string, name: string): SavedProject => ({
  id,
  name,
  latencyTarget: 30,
  monthlyBudget: 4500,
  nodes: initialNodes.map((node) => ({ ...node, position: { ...node.position }, data: { ...node.data } })),
  edges: initialEdges.map((edge) => ({ ...edge })),
});
const normalizeEdges = (edges: Edge[]): Edge[] => edges.map((edge) => ({
  ...edge,
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#2A2ACF" },
  style: { ...edge.style, stroke: "#2A2ACF", strokeWidth: 1.6 },
}));

function DecisionCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<StageNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>("3");
  const [projectName, setProjectName] = useState("Finance Revenue Pulse");
  const [latencyTarget, setLatencyTarget] = useState(30);
  const [monthlyBudget, setMonthlyBudget] = useState(4500);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("finance-revenue-pulse");
  const [exportState, setExportState] = useState<"idle" | "png" | "copied">("idle");
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved">("loading");
  const hydrated = useRef(false);
  const switchingProject = useRef(false);
  const saveTimer = useRef<number | null>(null);

  const totalLatency = useMemo(() => nodes.reduce((sum, node) => sum + node.data.latency, 0), [nodes]);
  const totalCost = useMemo(() => nodes.reduce((sum, node) => sum + node.data.cost, 0), [nodes]);
  const latencyVariance = totalLatency - latencyTarget;
  const budgetVariance = totalCost - monthlyBudget;
  const activeNode = nodes.find((node) => node.id === selectedId);
  const slowest = nodes.length ? nodes.reduce((a, b) => (a.data.latency > b.data.latency ? a : b)) : null;
  const costliest = nodes.length ? nodes.reduce((a, b) => (a.data.cost > b.data.cost ? a : b)) : null;

  useEffect(() => {
    try {
      const savedProjects = window.localStorage.getItem(projectsStorageKey);
      const legacy = window.localStorage.getItem(storageKey);
      let loadedProjects: SavedProject[];
      let activeId: string;

      if (savedProjects) {
        const saved = JSON.parse(savedProjects) as { activeProjectId?: string; projects?: SavedProject[] };
        loadedProjects = Array.isArray(saved.projects) && saved.projects.length
          ? saved.projects
          : [createDefaultProject("finance-revenue-pulse", "Finance Revenue Pulse")];
        activeId = saved.activeProjectId && loadedProjects.some((project) => project.id === saved.activeProjectId)
          ? saved.activeProjectId
          : loadedProjects[0].id;
      } else if (legacy) {
        const saved = JSON.parse(legacy) as Partial<SavedProject> & { projectName?: string };
        loadedProjects = [{
          ...createDefaultProject("finance-revenue-pulse", saved.projectName || "Finance Revenue Pulse"),
          latencyTarget: typeof saved.latencyTarget === "number" ? saved.latencyTarget : 30,
          monthlyBudget: typeof saved.monthlyBudget === "number" ? saved.monthlyBudget : 4500,
          nodes: Array.isArray(saved.nodes) ? saved.nodes : initialNodes,
          edges: Array.isArray(saved.edges) ? saved.edges : initialEdges,
        }];
        activeId = loadedProjects[0].id;
      } else {
        loadedProjects = [createDefaultProject("finance-revenue-pulse", "Finance Revenue Pulse")];
        activeId = loadedProjects[0].id;
      }

      const active = loadedProjects.find((project) => project.id === activeId)!;
      const normalizedNodes = active.nodes.map((node) => ({ ...node, data: { ...node.data, note: node.data.note ?? "" } }));
      setProjects(loadedProjects);
      setActiveProjectId(active.id);
      setProjectName(active.name);
      setLatencyTarget(active.latencyTarget);
      setMonthlyBudget(active.monthlyBudget);
      setNodes(normalizedNodes);
      setEdges(normalizeEdges(active.edges));
    } catch {
      const fallback = createDefaultProject("finance-revenue-pulse", "Finance Revenue Pulse");
      setProjects([fallback]);
      window.localStorage.removeItem(projectsStorageKey);
    }
    hydrated.current = true;
    setSaveStatus("saved");
  }, [setEdges, setNodes]);

  useEffect(() => {
    if (!hydrated.current || switchingProject.current) return;
    setSaveStatus("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setProjects((current) => {
        const updatedProject: SavedProject = {
          id: activeProjectId,
          name: projectName,
          latencyTarget,
          monthlyBudget,
          nodes,
          edges,
        };
        const updated = current.some((project) => project.id === activeProjectId)
          ? current.map((project) => project.id === activeProjectId ? updatedProject : project)
          : [...current, updatedProject];
        window.localStorage.setItem(projectsStorageKey, JSON.stringify({ activeProjectId, projects: updated }));
        return updated;
      });
      setSaveStatus("saved");
    }, 300);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [activeProjectId, projectName, latencyTarget, monthlyBudget, nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#2A2ACF" },
            style: { stroke: "#2A2ACF", strokeWidth: 1.7 },
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
        data: { kind: preset.kind, label: preset.label, platform: preset.platform, latency: 5, cost: 250, note: "" },
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
    const fresh = createDefaultProject(activeProjectId, projectName);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelectedId("3");
    setLatencyTarget(30);
    setMonthlyBudget(4500);
  };

  const currentProjectSnapshot = (): SavedProject => ({
    id: activeProjectId,
    name: projectName,
    latencyTarget,
    monthlyBudget,
    nodes,
    edges,
  });

  const loadProject = (project: SavedProject, projectList: SavedProject[]) => {
    switchingProject.current = true;
    setProjects(projectList);
    setActiveProjectId(project.id);
    setProjectName(project.name);
    setLatencyTarget(project.latencyTarget);
    setMonthlyBudget(project.monthlyBudget);
    setNodes(project.nodes.map((node) => ({ ...node, data: { ...node.data, note: node.data.note ?? "" } })));
    setEdges(normalizeEdges(project.edges));
    setSelectedId(project.nodes[0]?.id ?? null);
    window.localStorage.setItem(projectsStorageKey, JSON.stringify({ activeProjectId: project.id, projects: projectList }));
    window.requestAnimationFrame(() => {
      switchingProject.current = false;
      setSaveStatus("saved");
    });
  };

  const switchProject = (id: string) => {
    const withCurrentSaved = projects.map((project) => project.id === activeProjectId ? currentProjectSnapshot() : project);
    const target = withCurrentSaved.find((project) => project.id === id);
    if (target) loadProject(target, withCurrentSaved);
  };

  const addProject = () => {
    const id = `project-${Date.now()}`;
    const next = createDefaultProject(id, `New decision project ${projects.length + 1}`);
    const withCurrentSaved = projects.map((project) => project.id === activeProjectId ? currentProjectSnapshot() : project);
    loadProject(next, [...withCurrentSaved, next]);
  };

  const removeProject = () => {
    if (!window.confirm(`Remove “${projectName}” from this browser?`)) return;
    const remaining = projects.filter((project) => project.id !== activeProjectId);
    const projectList = remaining.length ? remaining : [createDefaultProject(`project-${Date.now()}`, "Untitled decision project")];
    loadProject(projectList[0], projectList);
  };

  const downloadPng = async () => {
    const viewportElement = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewportElement || !nodes.length) return;
    setExportState("png");
    try {
      const bounds = getNodesBounds(nodes);
      const graphWidth = Math.min(3200, Math.max(1800, Math.ceil(bounds.width + 320)));
      const graphHeight = Math.min(1800, Math.max(680, Math.ceil(bounds.height + 260)));
      const headerHeight = 150;
      const viewport = getViewportForBounds(bounds, graphWidth, graphHeight, 0.2, 1.5, 0.12);
      const graphUrl = await toPng(viewportElement, {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor: "#f7f7fc",
        width: graphWidth,
        height: graphHeight,
        style: {
          width: `${graphWidth}px`,
          height: `${graphHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });
      const graphImage = new Image();
      graphImage.src = graphUrl;
      await new Promise<void>((resolve, reject) => {
        graphImage.onload = () => resolve();
        graphImage.onerror = () => reject(new Error("Could not render the decision flow"));
      });
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = graphWidth;
      exportCanvas.height = graphHeight + headerHeight;
      const context = exportCanvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#2A2ACF";
      context.fillRect(0, 0, graphWidth, headerHeight);
      context.fillStyle = "#ffffff";
      context.font = "800 32px Arial";
      context.fillText(projectName, 56, 58);
      context.fillStyle = "#dadaff";
      context.font = "700 15px Arial";
      context.fillText("DeCLA · Decision Latency Intelligence", 56, 88);
      context.fillStyle = "#ffffff";
      context.font = "700 16px Arial";
      context.fillText(`Required freshness  ${latencyTarget} min`, graphWidth - 590, 58);
      context.fillText(`Monthly budget  $${monthlyBudget.toLocaleString()}`, graphWidth - 300, 58);
      context.fillStyle = latencyVariance > 0 ? "#ffb17e" : "#9dffda";
      context.fillText(`Current latency  ${totalLatency} min`, graphWidth - 590, 94);
      context.fillStyle = budgetVariance > 0 ? "#ffb17e" : "#9dffda";
      context.fillText(`Current cost  $${totalCost.toLocaleString()}`, graphWidth - 300, 94);
      context.drawImage(graphImage, 0, headerHeight, graphWidth, graphHeight);
      const link = document.createElement("a");
      link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "decla-canvas"}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    } finally {
      setExportState("idle");
    }
  };

  const copyMarkdown = async () => {
    const nodeName = new Map(nodes.map((node) => [node.id, node.data.label]));
    const stageRows = nodes
      .map((node) => `| ${node.data.label} | ${kindLabels[node.data.kind]} | ${node.data.platform} | ${node.data.latency} min | $${node.data.cost.toLocaleString()} | ${(node.data.note || "—").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`)
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

| Stage | Type | Platform | Latency | Monthly cost | Context |
|---|---|---|---:|---:|---|
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
        <div className="project-center">
          <div className="project-switcher">
            <select value={activeProjectId} onChange={(event) => switchProject(event.target.value)} aria-label="Select project">
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <button onClick={addProject} title="Add project">+ New</button>
            <button className="remove-project" onClick={removeProject} title="Remove current project">Remove</button>
          </div>
          <div className="project-title">
            <span className="status-dot" />
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Rename current project" title="Click to rename project" />
            <span className="draft">EDITABLE</span>
          </div>
        </div>
        <div className="top-actions">
          <span className={`local-status ${saveStatus}`}><i />{saveStatus === "loading" ? "Loading…" : saveStatus === "saving" ? "Saving…" : "Saved locally"}</span>
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
            <strong>{projectName}</strong>
            <small>Edit names directly on cards · select a stage for all details</small>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
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
              nodeColor={(node) => node.id === selectedId ? "#F36A10" : "#2A2ACF"}
              maskColor="rgba(247,247,243,.75)"
            />
          </ReactFlow>
        </section>

        <aside className="inspector">
          {activeNode ? (
            <>
            <div className="inspector-heading">
              <div><span>STAGE DETAILS</span><strong>{kindLabels[activeNode.data.kind]}</strong></div>
              <span className="editing-badge">EDITING</span>
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
            <label>Context note<textarea value={activeNode.data.note} onChange={(event) => updateNode({ note: event.target.value })} placeholder="Why this stage exists, operating assumptions, or decision context…" /></label>
            <button className="delete-button" onClick={deleteNode}>Remove stage</button>
            </>
          ) : (
            <div className="empty-inspector">
              <span>STAGE DETAILS</span>
              <strong>Select a stage to edit it</strong>
              <p>You can also rename a stage or platform directly on its canvas card.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function Home() {
  return <ReactFlowProvider><DecisionCanvas /></ReactFlowProvider>;
}

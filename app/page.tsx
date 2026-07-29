"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type StageKind = "source" | "ingest" | "store" | "transform" | "serve" | "consume";
type LatencyUnit = "min" | "hr" | "day";

type Stage = {
  id: string;
  kind: StageKind;
  label: string;
  platform: string;
  latency: number;
  cost: number;
  note: string;
};

type SavedProject = {
  id: string;
  name: string;
  businessGoal: string;
  latencyTarget: number;
  latencyUnit: LatencyUnit;
  monthlyBudget: number;
  stages: Stage[];
};

type LegacyStageNode = {
  id: string;
  data?: Partial<Omit<Stage, "id">>;
};

type LegacyProject = Partial<SavedProject> & {
  nodes?: LegacyStageNode[];
};

const stageCatalog: Array<{
  kind: StageKind;
  label: string;
  platform: string;
  shortLabel: string;
}> = [
  { kind: "source", label: "Data source", platform: "PostgreSQL", shortLabel: "SRC" },
  { kind: "ingest", label: "Ingestion", platform: "Airflow", shortLabel: "ING" },
  { kind: "store", label: "Storage", platform: "Databricks", shortLabel: "STR" },
  { kind: "transform", label: "Transform", platform: "dbt", shortLabel: "TRN" },
  { kind: "serve", label: "Semantic layer", platform: "Snowflake", shortLabel: "SRV" },
  { kind: "consume", label: "Consumption", platform: "Power BI", shortLabel: "USE" },
];

const initialStages: Stage[] = [
  { id: "1", kind: "source", label: "Order events", platform: "PostgreSQL", latency: 1, cost: 180, note: "Operational order events captured at source." },
  { id: "2", kind: "ingest", label: "Extract and load", platform: "Airflow", latency: 8, cost: 460, note: "Scheduled extraction and load orchestration." },
  { id: "3", kind: "store", label: "Lakehouse", platform: "Databricks", latency: 5, cost: 1680, note: "Business-critical stage for the executive finance review." },
  { id: "4", kind: "transform", label: "Revenue model", platform: "dbt", latency: 12, cost: 920, note: "Curates finance-ready revenue measures." },
  { id: "5", kind: "serve", label: "Finance semantic", platform: "Snowflake", latency: 3, cost: 1240, note: "Governed semantic model for finance consumers." },
  { id: "6", kind: "consume", label: "Executive P&L", platform: "Power BI", latency: 15, cost: 680, note: "Executive dashboard reviewed throughout the day." },
];

const storageKey = "decla-projects-v3";
const legacyStorageKey = "decla-projects-v2";

function cloneStages(stages: Stage[]) {
  return stages.map((stage) => ({ ...stage }));
}

function createProject(id: string, name: string): SavedProject {
  return {
    id,
    name,
    businessGoal: "Give finance leaders a trusted revenue view before each executive review.",
    latencyTarget: 60,
    latencyUnit: "min",
    monthlyBudget: 6000,
    stages: cloneStages(initialStages),
  };
}

function normalizeProject(raw: LegacyProject, fallbackIndex = 0): SavedProject {
  const legacyStages = Array.isArray(raw.nodes)
    ? raw.nodes.map((node, index) => ({
        id: node.id || `legacy-${index}`,
        kind: node.data?.kind || "transform",
        label: node.data?.label || "Untitled stage",
        platform: node.data?.platform || "Not set",
        latency: Number(node.data?.latency) || 0,
        cost: Number(node.data?.cost) || 0,
        note: node.data?.note || "",
      }))
    : [];
  const stages = Array.isArray(raw.stages) && raw.stages.length
    ? raw.stages.map((stage, index) => ({
        id: stage.id || `stage-${index}`,
        kind: stage.kind || "transform",
        label: stage.label || "Untitled stage",
        platform: stage.platform || "Not set",
        latency: Number(stage.latency) || 0,
        cost: Number(stage.cost) || 0,
        note: stage.note || "",
      }))
    : legacyStages;

  return {
    id: raw.id || `project-${fallbackIndex}`,
    name: raw.name || "Untitled decision",
    businessGoal: raw.businessGoal || "",
    latencyTarget: Number(raw.latencyTarget) || 60,
    latencyUnit: raw.latencyUnit || "min",
    monthlyBudget: Number(raw.monthlyBudget) || 0,
    stages: stages.length ? stages : cloneStages(initialStages),
  };
}

function targetToMinutes(value: number, unit: LatencyUnit) {
  if (unit === "hr") return value * 60;
  if (unit === "day") return value * 1440;
  return value;
}

export default function Home() {
  const defaultProject = useMemo(
    () => createProject("finance-revenue-pulse", "Finance Revenue Pulse"),
    [],
  );
  const [projects, setProjects] = useState<SavedProject[]>([defaultProject]);
  const [activeProjectId, setActiveProjectId] = useState(defaultProject.id);
  const [projectName, setProjectName] = useState(defaultProject.name);
  const [businessGoal, setBusinessGoal] = useState(defaultProject.businessGoal);
  const [latencyTarget, setLatencyTarget] = useState(defaultProject.latencyTarget);
  const [latencyUnit, setLatencyUnit] = useState<LatencyUnit>(defaultProject.latencyUnit);
  const [monthlyBudget, setMonthlyBudget] = useState(defaultProject.monthlyBudget);
  const [stages, setStages] = useState<Stage[]>(defaultProject.stages);
  const [selectedId, setSelectedId] = useState(defaultProject.stages[0]?.id ?? null);
  const [newStageKind, setNewStageKind] = useState<StageKind>("transform");
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved">("loading");
  const [copied, setCopied] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalLatency = useMemo(
    () => stages.reduce((total, stage) => total + stage.latency, 0),
    [stages],
  );
  const totalCost = useMemo(
    () => stages.reduce((total, stage) => total + stage.cost, 0),
    [stages],
  );
  const targetMinutes = targetToMinutes(latencyTarget, latencyUnit);
  const latencyWithinTarget = totalLatency <= targetMinutes;
  const budgetWithinTarget = totalCost <= monthlyBudget;
  const selectedStage = stages.find((stage) => stage.id === selectedId) ?? null;

  const currentProject = useMemo<SavedProject>(
    () => ({
      id: activeProjectId,
      name: projectName,
      businessGoal,
      latencyTarget,
      latencyUnit,
      monthlyBudget,
      stages,
    }),
    [
      activeProjectId,
      projectName,
      businessGoal,
      latencyTarget,
      latencyUnit,
      monthlyBudget,
      stages,
    ],
  );

  const loadProject = (project: SavedProject) => {
    setActiveProjectId(project.id);
    setProjectName(project.name);
    setBusinessGoal(project.businessGoal);
    setLatencyTarget(project.latencyTarget);
    setLatencyUnit(project.latencyUnit);
    setMonthlyBudget(project.monthlyBudget);
    setStages(cloneStages(project.stages));
    setSelectedId(project.stages[0]?.id ?? null);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        const legacy = window.localStorage.getItem(legacyStorageKey);
        const parsed = JSON.parse(stored || legacy || "null") as
          | { activeProjectId?: string; projects?: LegacyProject[] }
          | null;
        if (parsed?.projects?.length) {
          const normalized = parsed.projects.map(normalizeProject);
          const active =
            normalized.find((project) => project.id === parsed.activeProjectId) ||
            normalized[0];
          setProjects(normalized);
          loadProject(active);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        hydrated.current = true;
        setSaveStatus("saved");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    setSaveStatus("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setProjects((current) => {
        const updated = current.some((project) => project.id === activeProjectId)
          ? current.map((project) => (project.id === activeProjectId ? currentProject : project))
          : [...current, currentProject];
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ activeProjectId, projects: updated }),
        );
        return updated;
      });
      setSaveStatus("saved");
    }, 350);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [activeProjectId, currentProject]);

  const switchProject = (id: string) => {
    const updated = projects.map((project) =>
      project.id === activeProjectId ? currentProject : project,
    );
    const target = updated.find((project) => project.id === id);
    if (!target) return;
    setProjects(updated);
    loadProject(target);
  };

  const addProject = () => {
    const id = `project-${Date.now()}`;
    const next = createProject(id, `Decision project ${projects.length + 1}`);
    next.businessGoal = "";
    const updated = [
      ...projects.map((project) =>
        project.id === activeProjectId ? currentProject : project,
      ),
      next,
    ];
    setProjects(updated);
    loadProject(next);
  };

  const updateSelectedStage = (patch: Partial<Omit<Stage, "id">>) => {
    if (!selectedId) return;
    setStages((current) =>
      current.map((stage) => (stage.id === selectedId ? { ...stage, ...patch } : stage)),
    );
  };

  const addStage = () => {
    const preset = stageCatalog.find((item) => item.kind === newStageKind)!;
    const stage: Stage = {
      id: `stage-${Date.now()}`,
      kind: preset.kind,
      label: preset.label,
      platform: preset.platform,
      latency: 5,
      cost: 250,
      note: "",
    };
    setStages((current) => [...current, stage]);
    setSelectedId(stage.id);
  };

  const removeStage = (id: string) => {
    setStages((current) => {
      const next = current.filter((stage) => stage.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const moveStage = (id: string, direction: -1 | 1) => {
    setStages((current) => {
      const index = current.findIndex((stage) => stage.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const copySummary = async () => {
    const lines = [
      `# ${projectName}`,
      "",
      businessGoal || "No business objective set.",
      "",
      `- Total latency: ${totalLatency} minutes`,
      `- Monthly cost: $${totalCost.toLocaleString()}`,
      "",
      ...stages.flatMap((stage, index) => [
        `## ${index + 1}. ${stage.label}`,
        `${stage.platform} · ${stage.latency} min · $${stage.cost.toLocaleString()}/month`,
        stage.note,
        "",
      ]),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <div>
            <strong>DeCLA</strong>
            <small>Decision latency architecture</small>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`save-status ${saveStatus}`}>
            <i />
            {saveStatus === "loading" ? "Loading" : saveStatus === "saving" ? "Saving" : "Saved locally"}
          </span>
          <button className="secondary-button" onClick={copySummary}>
            {copied ? "Copied" : "Copy summary"}
          </button>
        </div>
      </header>

      <div className="page">
        <section className="project-card">
          <div className="project-heading">
            <label className="project-switcher">
              <span>Project</span>
              <select value={activeProjectId} onChange={(event) => switchProject(event.target.value)} aria-label="Select project">
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.id === activeProjectId ? projectName : project.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="text-button" onClick={addProject}>+ New project</button>
          </div>
          <div className="project-fields">
            <label>
              <span>Project name</span>
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Project name" />
            </label>
            <label className="goal-input">
              <span>Business objective</span>
              <input value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value)} placeholder="What decision should this architecture improve?" />
            </label>
          </div>
        </section>

        <section className="metrics" aria-label="Project totals">
          <article>
            <span>Total latency</span>
            <strong>{totalLatency} min</strong>
            <small className={latencyWithinTarget ? "good" : "warning"}>
              {latencyWithinTarget ? `${targetMinutes - totalLatency} min inside target` : `${totalLatency - targetMinutes} min over target`}
            </small>
          </article>
          <article>
            <span>Latency target</span>
            <div className="metric-input">
              <input type="number" min="1" value={latencyTarget} onChange={(event) => setLatencyTarget(Number(event.target.value))} aria-label="Latency target" />
              <select value={latencyUnit} onChange={(event) => setLatencyUnit(event.target.value as LatencyUnit)} aria-label="Latency unit">
                <option value="min">min</option>
                <option value="hr">hr</option>
                <option value="day">day</option>
              </select>
            </div>
            <small>Decision-ready SLA</small>
          </article>
          <article>
            <span>Monthly cost</span>
            <strong>${totalCost.toLocaleString()}</strong>
            <small className={budgetWithinTarget ? "good" : "warning"}>
              {budgetWithinTarget ? `$${(monthlyBudget - totalCost).toLocaleString()} available` : `$${(totalCost - monthlyBudget).toLocaleString()} over budget`}
            </small>
          </article>
          <article>
            <span>Monthly budget</span>
            <div className="metric-input budget">
              <b>$</b>
              <input type="number" min="0" step="100" value={monthlyBudget} onChange={(event) => setMonthlyBudget(Number(event.target.value))} aria-label="Monthly budget" />
            </div>
            <small>Approved run cost</small>
          </article>
        </section>

        <div className="content-grid">
          <section className="pipeline-card">
            <div className="section-heading">
              <div>
                <span>ARCHITECTURE</span>
                <h1>Decision path</h1>
                <p>Stages run from top to bottom.</p>
              </div>
              <strong>{stages.length} stages</strong>
            </div>

            <div className="stage-list">
              {stages.map((stage, index) => {
                const catalogItem = stageCatalog.find((item) => item.kind === stage.kind);
                const isSelected = stage.id === selectedId;
                return (
                  <div className="stage-row" key={stage.id}>
                    <div
                      className={`stage-card ${isSelected ? "selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(stage.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(stage.id);
                        }
                      }}
                      aria-pressed={isSelected}
                    >
                      <span className={`stage-icon ${stage.kind}`}>{catalogItem?.shortLabel}</span>
                      <span className="stage-copy">
                        <small>{String(index + 1).padStart(2, "0")} · {catalogItem?.label}</small>
                        <strong>{stage.label}</strong>
                        <span>{stage.platform}</span>
                      </span>
                      <span className="stage-metrics">
                        <span><small>Latency</small><strong>{stage.latency} min</strong></span>
                        <span><small>Monthly</small><strong>${stage.cost.toLocaleString()}</strong></span>
                      </span>
                      <span className="stage-actions">
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Move ${stage.label} up`}
                          className={index === 0 ? "disabled" : ""}
                          onClick={(event) => { event.stopPropagation(); moveStage(stage.id, -1); }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              moveStage(stage.id, -1);
                            }
                          }}
                        >↑</span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Move ${stage.label} down`}
                          className={index === stages.length - 1 ? "disabled" : ""}
                          onClick={(event) => { event.stopPropagation(); moveStage(stage.id, 1); }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              moveStage(stage.id, 1);
                            }
                          }}
                        >↓</span>
                      </span>
                    </div>
                    {index < stages.length - 1 && <div className="stage-connector" aria-hidden="true"><i /></div>}
                  </div>
                );
              })}
            </div>

            <div className="add-stage">
              <select value={newStageKind} onChange={(event) => setNewStageKind(event.target.value as StageKind)} aria-label="Stage type">
                {stageCatalog.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
              </select>
              <button className="primary-button" onClick={addStage}>Add stage</button>
            </div>
          </section>

          <aside className="details-card">
            {selectedStage ? (
              <>
                <div className="section-heading compact">
                  <div><span>SELECTED STAGE</span><h2>Edit details</h2></div>
                </div>
                <label>
                  <span>Stage name</span>
                  <input value={selectedStage.label} onChange={(event) => updateSelectedStage({ label: event.target.value })} />
                </label>
                <label>
                  <span>Platform</span>
                  <input value={selectedStage.platform} onChange={(event) => updateSelectedStage({ platform: event.target.value })} />
                </label>
                <div className="field-pair">
                  <label>
                    <span>Latency (min)</span>
                    <input type="number" min="0" value={selectedStage.latency} onChange={(event) => updateSelectedStage({ latency: Number(event.target.value) })} />
                  </label>
                  <label>
                    <span>Cost / month</span>
                    <input type="number" min="0" value={selectedStage.cost} onChange={(event) => updateSelectedStage({ cost: Number(event.target.value) })} />
                  </label>
                </div>
                <label>
                  <span>Context note</span>
                  <textarea rows={5} value={selectedStage.note} onChange={(event) => updateSelectedStage({ note: event.target.value })} placeholder="Why this stage exists or what assumptions it carries." />
                </label>
                <button className="danger-button" onClick={() => removeStage(selectedStage.id)}>Remove stage</button>
              </>
            ) : (
              <div className="empty-details">
                <span>NO STAGE SELECTED</span>
                <h2>Select a stage to edit it</h2>
                <p>Choose any item in the vertical path.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

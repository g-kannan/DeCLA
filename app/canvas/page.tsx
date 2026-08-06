"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/app/components/app-shell";
import { api, type DataflowSummary, type JsonSchemaProperty, type Stage, type StageType, type Version } from "@/lib/api";
import { formatValue, numberValue } from "@/lib/format";
import { StageIcon } from "@/lib/stage-icons";

type CanvasView = "current" | "proposed";
type LoadStatus = "loading" | "saving" | "ready" | "error";

function propertyInputType(property: JsonSchemaProperty) {
  return property.type === "number" || property.type === "integer" ? "number" : "text";
}

function updateDataflowQuery(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("dataflow", id);
  window.history.replaceState({}, "", url);
}

export default function DecisionCanvasPage() {
  const [dataflows, setDataflows] = useState<DataflowSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [stageTypes, setStageTypes] = useState<StageType[]>([]);
  const [current, setCurrent] = useState<Version | null>(null);
  const [proposed, setProposed] = useState<Version | null>(null);
  const [view, setView] = useState<CanvasView>("current");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStageTypeId, setNewStageTypeId] = useState("");
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newDecision, setNewDecision] = useState({ name: "", description: "", business_goal: "", latency_target_minutes: 60, monthly_budget: 0 });

  const loadFlow = useCallback(async (id: string, preferredView?: CanvasView) => {
    setStatus("loading");
    setMessage("");
    try {
      const currentVersion = await api.getVersion(id, "current");
      let proposedVersion: Version | null = null;
      try {
        proposedVersion = await api.getVersion(id, "proposed");
      } catch {
        // A new dataflow may not have a proposed version yet.
      }
      const nextView = preferredView === "proposed" && proposedVersion ? "proposed" : preferredView ?? "current";
      setCurrent(currentVersion);
      setProposed(proposedVersion);
      setView(nextView);
      setSelectedId((nextView === "proposed" ? proposedVersion : currentVersion)?.stages[0]?.id ?? null);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load the dataflow");
    }
  }, []);

  useEffect(() => {
    Promise.all([api.listDataflows(), api.listStageTypes()])
      .then(([flows, types]) => {
        setDataflows(flows);
        setStageTypes(types);
        setNewStageTypeId(types[0]?.version.id ?? "");
        const requestedId = new URLSearchParams(window.location.search).get("dataflow");
        const initial = flows.find((item) => item.id === requestedId) ?? flows[0];
        if (initial) {
          setActiveId(initial.id);
          updateDataflowQuery(initial.id);
          return loadFlow(initial.id);
        }
        setStatus("ready");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not connect to the API");
      });
  }, [loadFlow]);

  const visibleVersion = view === "proposed" ? proposed : current;
  const editable = view === "proposed" && proposed?.status === "draft";
  const selectedStage = visibleVersion?.stages.find((stage) => stage.id === selectedId) ?? null;
  const selectedStageType = stageTypes.find((item) => item.version.id === selectedStage?.stage_type_version_id);
  const pendingStageType = stageTypes.find((item) => item.version.id === newStageTypeId);
  const flow = dataflows.find((item) => item.id === activeId);
  const filteredDataflows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? dataflows.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query)) : dataflows;
  }, [dataflows, search]);
  const freshness = visibleVersion?.measures.find((item) => item.measure_key === "data_freshness");
  const cost = visibleVersion?.measures.find((item) => item.measure_key === "operational_cost");
  const failurePoints = visibleVersion?.measures.find((item) => item.measure_key === "failure_points");

  const changeFlow = (id: string) => {
    setActiveId(id);
    updateDataflowQuery(id);
    loadFlow(id, view);
  };

  const switchView = (next: CanvasView) => {
    setView(next);
    setSelectedId((next === "proposed" ? proposed : current)?.stages[0]?.id ?? null);
  };

  const updateProposed = (patch: Partial<Version>) => setProposed((value) => value ? { ...value, ...patch } : value);

  const updateStage = (stageId: string, patch: Partial<Stage>) => {
    if (!proposed) return;
    updateProposed({ stages: proposed.stages.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage) });
  };

  const updateMeasure = (definitionId: string, numericValue: number) => {
    if (!proposed) return;
    updateProposed({
      measures: proposed.measures.map((measure) =>
        measure.measure_definition_id === definitionId && !measure.stage_id
          ? { ...measure, numeric_value: numericValue, source: "estimated" }
          : measure,
      ),
    });
  };

  const saveProposed = async () => {
    if (!proposed || !activeId) return;
    setStatus("saving");
    setMessage("");
    try {
      const saved = await api.updateVersion(activeId, proposed);
      setProposed(saved);
      setSelectedId(saved.stages.find((stage) => stage.logical_key === selectedStage?.logical_key)?.id ?? null);
      setStatus("ready");
      setMessage("Proposed version saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save the proposed version");
    }
  };

  const createProposed = async () => {
    if (!activeId) return;
    setStatus("saving");
    try {
      const version = await api.cloneProposed(activeId);
      setProposed(version);
      setView("proposed");
      setSelectedId(version.stages[0]?.id ?? null);
      setStatus("ready");
      setMessage("Proposed version created from current");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not create a proposed version");
    }
  };

  const createDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newDecision.name.trim()) return;
    setStatus("saving");
    setMessage("");
    try {
      const created = await api.createDataflow({
        ...newDecision,
        name: newDecision.name.trim(),
        description: newDecision.description.trim(),
        business_goal: newDecision.business_goal.trim(),
        monthly_budget: newDecision.monthly_budget || null,
      });
      const flows = await api.listDataflows();
      setDataflows(flows);
      setActiveId(created.dataflow_id);
      updateDataflowQuery(created.dataflow_id);
      setCreateOpen(false);
      setNewDecision({ name: "", description: "", business_goal: "", latency_target_minutes: 60, monthly_budget: 0 });
      await loadFlow(created.dataflow_id);
      setMessage("Decision created. Clone the current version when you are ready to propose changes.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not create the decision");
    }
  };

  const addStage = () => {
    if (!proposed || !pendingStageType) return;
    const id = crypto.randomUUID();
    const stage: Stage = {
      id,
      logical_key: `${pendingStageType.key}_${Date.now()}`,
      stage_type_version_id: pendingStageType.version.id,
      position: proposed.stages.length,
      label: pendingStageType.name,
      platform: "",
      properties: {},
      note: "",
      stage_type_key: pendingStageType.key,
      stage_type_name: pendingStageType.name,
      category: pendingStageType.category,
      icon: pendingStageType.icon,
      color: pendingStageType.color,
    };
    updateProposed({ stages: [...proposed.stages, stage] });
    setSelectedId(id);
  };

  const removeStage = (id: string) => {
    if (!proposed) return;
    const stages = proposed.stages.filter((stage) => stage.id !== id).map((stage, position) => ({ ...stage, position }));
    updateProposed({ stages });
    setSelectedId(stages[0]?.id ?? null);
  };

  const moveStage = (id: string, direction: -1 | 1) => {
    if (!proposed) return;
    const stages = [...proposed.stages];
    const index = stages.findIndex((stage) => stage.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= stages.length) return;
    [stages[index], stages[target]] = [stages[target], stages[index]];
    updateProposed({ stages: stages.map((stage, position) => ({ ...stage, position })) });
  };

  const saveAction = editable ? <button className="primary-button compact-button" onClick={saveProposed}>Save proposed</button> : null;

  if (status === "loading" && !current) {
    return <AppShell status={status}><div className="center-state"><div className="spinner" /><p>Loading decision canvas…</p></div></AppShell>;
  }

  return (
    <AppShell status={status} action={saveAction} activeDataflowId={activeId}>
      <header className="page-heading">
        <div><span>ARCHITECTURE WORKSPACE</span><h1>Decision canvas</h1><p>Inspect the current path or shape the next version of your decision architecture.</p></div>
        <button className="primary-button" onClick={() => setCreateOpen(true)}>New decision</button>
      </header>
      {message && <div className={`notice ${status === "error" ? "error" : ""}`}>{message}</div>}

      {dataflows.length === 0 && <section className="empty-page"><h1>No dataflows yet</h1><p>Create one through the API to start a decision canvas.</p></section>}

      {visibleVersion && <div className="decision-workbench">
        <aside className="decision-library">
          <div className="library-heading"><div><span>DECISIONS</span><strong>All decisions</strong></div><b>{dataflows.length}</b></div>
          <input className="decision-search" type="search" placeholder="Search decisions…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search decisions" />
          <div className="decision-list">
            {filteredDataflows.map((item) => <button key={item.id} className={item.id === activeId ? "active" : ""} onClick={() => changeFlow(item.id)}>
              <span className="decision-avatar">{item.name.slice(0, 1).toUpperCase()}</span>
              <span><strong>{item.name}</strong><small>{item.description || "No description"}</small><i>Current v{item.current_version_number ?? "—"}{item.proposed_version_number ? ` · Proposed v${item.proposed_version_number}` : ""}</i></span>
            </button>)}
            {filteredDataflows.length === 0 && <p className="library-empty">No decisions match your search.</p>}
          </div>
          <button className="secondary-button library-add" onClick={() => setCreateOpen(true)}>+ Add decision</button>
        </aside>

        <div className="canvas-workspace">
        <section className="active-decision-bar">
          <div><span>ACTIVE DECISION</span><strong>{flow?.name}</strong><small>{flow?.description || "No description provided"}</small></div>
          <span className="version-line">Current v{flow?.current_version_number ?? "—"} · Proposed v{flow?.proposed_version_number ?? "—"}</span>
        </section>
        <section className="canvas-version-bar">
          <div className="version-tabs" role="tablist" aria-label="Canvas version">
            <button className={view === "current" ? "active" : ""} onClick={() => switchView("current")}>Current <b>v{current?.version_number}</b></button>
            <button className={view === "proposed" ? "active" : ""} onClick={() => proposed ? switchView("proposed") : createProposed()}>Proposed <b>{proposed ? `v${proposed.version_number}` : "+ Create"}</b></button>
          </div>
          <div className="project-fields">
            <label><span>Version name</span><input value={visibleVersion.version_name} disabled={!editable} onChange={(event) => updateProposed({ version_name: event.target.value })} /></label>
            <label className="goal-input"><span>Business objective</span><input value={visibleVersion.business_goal} disabled={!editable} onChange={(event) => updateProposed({ business_goal: event.target.value })} /></label>
          </div>
        </section>

        <section className="metrics" aria-label="Version totals">
          <article><span>Data freshness</span><strong>{formatValue(freshness?.numeric_value ?? null, "minutes")}</strong><small className={numberValue(freshness?.numeric_value) <= numberValue(visibleVersion.latency_target_minutes) ? "good" : "warning"}>Target {formatValue(visibleVersion.latency_target_minutes, "minutes")}</small></article>
          <article><span>Operational cost</span><strong>{formatValue(cost?.numeric_value ?? null, "USD/month")}</strong><small>Budget {formatValue(visibleVersion.monthly_budget, "USD/month")}</small></article>
          <article><span>Failure points</span><strong>{formatValue(failurePoints?.numeric_value ?? null, "count")}</strong><small>Across {visibleVersion.stages.length} stages</small></article>
          <article><span>Version state</span><strong className="capitalize">{visibleVersion.status}</strong><small>{visibleVersion.tags.join(", ") || "Untagged"}</small></article>
        </section>

        <div className="content-grid">
          <section className="pipeline-card">
            <div className="section-heading"><div><span>{view.toUpperCase()} ARCHITECTURE</span><h2>Decision path</h2><p>Every stage belongs to version {visibleVersion.version_number}.</p></div><strong>{visibleVersion.stages.length} stages</strong></div>
            <div className="stage-list">
              {visibleVersion.stages.map((stage, index) => <div className="stage-row" key={stage.id}>
                <div className={`stage-card ${selectedId === stage.id ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => setSelectedId(stage.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(stage.id); }}>
                  <StageIcon stage={stage} />
                  <span className="stage-copy"><small>{String(index + 1).padStart(2, "0")} · {stage.stage_type_name}</small><strong>{stage.label}</strong><span>{stage.platform || "Platform not set"}</span></span>
                  <span className="stage-metrics"><span><small>Category</small><strong>{stage.category}</strong></span><span><small>State</small><strong>{view}</strong></span></span>
                  {editable && <span className="stage-actions"><button aria-label={`Move ${stage.label} up`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveStage(stage.id, -1); }}>↑</button><button aria-label={`Move ${stage.label} down`} disabled={index === visibleVersion.stages.length - 1} onClick={(event) => { event.stopPropagation(); moveStage(stage.id, 1); }}>↓</button></span>}
                </div>
                {index < visibleVersion.stages.length - 1 && <div className="stage-connector" aria-hidden="true"><i /></div>}
              </div>)}
            </div>
            {editable && <div className="add-stage">{pendingStageType && <StageIcon stage={{ label: pendingStageType.name, stage_type_key: pendingStageType.key, category: pendingStageType.category }} />}<select value={newStageTypeId} onChange={(event) => setNewStageTypeId(event.target.value)} aria-label="Stage type">{stageTypes.map((item) => <option key={item.version.id} value={item.version.id}>{item.name}</option>)}</select><button className="primary-button" onClick={addStage}>Add stage</button></div>}
          </section>

          <aside className="details-card">
            {selectedStage ? <>
              <div className="selected-stage-summary"><StageIcon stage={selectedStage} className="large" decorative={false} /><div><span>SELECTED STAGE</span><h2>{editable ? "Edit details" : "Stage details"}</h2><small>{selectedStage.platform || selectedStage.stage_type_name}</small></div></div>
              <label><span>Stage name</span><input value={selectedStage.label} disabled={!editable} onChange={(event) => updateStage(selectedStage.id, { label: event.target.value })} /></label>
              <label><span>Platform</span><input value={selectedStage.platform} disabled={!editable} onChange={(event) => updateStage(selectedStage.id, { platform: event.target.value })} /></label>
              {Object.entries(selectedStageType?.version.schema.properties ?? {}).map(([key, property]) => <label key={key}><span>{property.title || key.replaceAll("_", " ")}{selectedStageType?.version.schema.required?.includes(key) ? " *" : ""}</span>{property.enum ? <select disabled={!editable} value={String(selectedStage.properties[key] ?? "")} onChange={(event) => updateStage(selectedStage.id, { properties: { ...selectedStage.properties, [key]: event.target.value } })}><option value="">Select…</option>{property.enum.map((value) => <option key={String(value)} value={String(value)}>{String(value)}</option>)}</select> : property.type === "boolean" ? <select disabled={!editable} value={String(selectedStage.properties[key] ?? false)} onChange={(event) => updateStage(selectedStage.id, { properties: { ...selectedStage.properties, [key]: event.target.value === "true" } })}><option value="true">Yes</option><option value="false">No</option></select> : <input disabled={!editable} type={propertyInputType(property)} value={String(selectedStage.properties[key] ?? "")} onChange={(event) => updateStage(selectedStage.id, { properties: { ...selectedStage.properties, [key]: property.type === "number" || property.type === "integer" ? Number(event.target.value) : event.target.value } })} />}</label>)}
              <label><span>Context note</span><textarea rows={5} disabled={!editable} value={selectedStage.note} onChange={(event) => updateStage(selectedStage.id, { note: event.target.value })} /></label>
              {editable && <button className="danger-button" onClick={() => removeStage(selectedStage.id)}>Remove stage</button>}
            </> : <div className="empty-details"><span>NO STAGE SELECTED</span><h2>Select a stage</h2><p>Choose any item in the decision path.</p></div>}
          </aside>
        </div>

        <section className="version-measures-card">
          <div className="section-heading"><div><span>MEASURABLES</span><h2>Version measures</h2><p>Values belong to this complete dataflow version.</p></div><strong>{visibleVersion.measures.filter((item) => !item.stage_id).length} measures</strong></div>
          <div className="measure-grid">{visibleVersion.measures.filter((item) => !item.stage_id).map((measure) => <label key={measure.id}><span>{measure.measure_name}<small>{measure.unit} · {measure.improvement_direction.replaceAll("_", " ")}</small></span><input type="number" disabled={!editable} value={numberValue(measure.numeric_value)} onChange={(event) => updateMeasure(measure.measure_definition_id, Number(event.target.value))} /></label>)}</div>
        </section>
        </div>
      </div>}

      {createOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
        <section className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="new-decision-title">
          <div className="modal-heading"><div><span>NEW DECISION</span><h2 id="new-decision-title">Start a decision canvas</h2><p>Capture the outcome first. You can shape its architecture next.</p></div><button aria-label="Close" onClick={() => setCreateOpen(false)}>×</button></div>
          <form onSubmit={createDecision}>
            <label><span>Decision name *</span><input autoFocus required value={newDecision.name} onChange={(event) => setNewDecision((value) => ({ ...value, name: event.target.value }))} placeholder="e.g. Real-time fraud response" /></label>
            <label><span>Description</span><input value={newDecision.description} onChange={(event) => setNewDecision((value) => ({ ...value, description: event.target.value }))} placeholder="What decision does this architecture support?" /></label>
            <label><span>Business objective</span><textarea rows={3} value={newDecision.business_goal} onChange={(event) => setNewDecision((value) => ({ ...value, business_goal: event.target.value }))} placeholder="Describe the outcome and who benefits" /></label>
            <div className="field-pair"><label><span>Latency target (minutes)</span><input type="number" min="0" value={newDecision.latency_target_minutes} onChange={(event) => setNewDecision((value) => ({ ...value, latency_target_minutes: Number(event.target.value) }))} /></label><label><span>Monthly budget (USD)</span><input type="number" min="0" value={newDecision.monthly_budget} onChange={(event) => setNewDecision((value) => ({ ...value, monthly_budget: Number(event.target.value) }))} /></label></div>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-button" type="submit">Create decision</button></div>
          </form>
        </section>
      </div>}
    </AppShell>
  );
}

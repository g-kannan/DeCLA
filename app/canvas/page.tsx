"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/app/components/app-shell";
import { api, type DataflowSummary, type JsonSchemaProperty, type MeasureDefinition, type Stage, type StageType, type Version } from "@/lib/api";
import { formatValue, numberValue } from "@/lib/format";
import { StageIcon } from "@/lib/stage-icons";

type LoadStatus = "loading" | "saving" | "ready" | "error";

function latestVersion(current: Version | null, proposed: Version | null) {
  if (!current) return proposed;
  if (!proposed) return current;
  return proposed.version_number >= current.version_number ? proposed : current;
}

function latestVersionNumber(dataflow: DataflowSummary) {
  return Math.max(dataflow.current_version_number ?? 0, dataflow.proposed_version_number ?? 0) || null;
}

function cumulativeMeasure(version: Version | null, measureKey: string, aggregation = "sum") {
  if (!version) return null;
  const stageValues = version.measures.filter((measure) => measure.stage_id && measure.measure_key === measureKey && measure.numeric_value != null);
  if (stageValues.length) {
    const values = stageValues.map((measure) => numberValue(measure.numeric_value));
    if (aggregation === "average") return values.reduce((total, value) => total + value, 0) / values.length;
    if (aggregation === "maximum") return Math.max(...values);
    if (aggregation === "count") return values.length;
    if (aggregation === "distinct_count") return new Set(values).size;
    return values.reduce((total, value) => total + value, 0);
  }
  return version.measures.find((measure) => !measure.stage_id && measure.measure_key === measureKey)?.numeric_value ?? null;
}

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
  const [measureDefinitions, setMeasureDefinitions] = useState<MeasureDefinition[]>([]);
  const [current, setCurrent] = useState<Version | null>(null);
  const [proposed, setProposed] = useState<Version | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStageTypeId, setNewStageTypeId] = useState("");
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newDecision, setNewDecision] = useState({ name: "", description: "", business_goal: "", latency_target_minutes: 60, monthly_budget: 0 });

  const loadFlow = useCallback(async (id: string) => {
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
      setCurrent(currentVersion);
      setProposed(proposedVersion);
      setSelectedId(latestVersion(currentVersion, proposedVersion)?.stages[0]?.id ?? null);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load the dataflow");
    }
  }, []);

  useEffect(() => {
    Promise.all([api.listDataflows(), api.listStageTypes(), api.listMeasures()])
      .then(([flows, types, measures]) => {
        setDataflows(flows);
        setStageTypes(types);
        setMeasureDefinitions(measures);
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

  const visibleVersion = latestVersion(current, proposed);
  const editable = visibleVersion?.status === "draft";
  const selectedStage = visibleVersion?.stages.find((stage) => stage.id === selectedId) ?? null;
  const selectedStageType = stageTypes.find((item) => item.version.id === selectedStage?.stage_type_version_id);
  const pendingStageType = stageTypes.find((item) => item.version.id === newStageTypeId);
  const flow = dataflows.find((item) => item.id === activeId);
  const filteredDataflows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? dataflows.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query)) : dataflows;
  }, [dataflows, search]);
  const aggregationFor = (key: string) => measureDefinitions.find((definition) => definition.key === key)?.aggregation;
  const freshness = cumulativeMeasure(visibleVersion, "data_freshness", aggregationFor("data_freshness"));
  const cost = cumulativeMeasure(visibleVersion, "operational_cost", aggregationFor("operational_cost"));
  const failurePoints = cumulativeMeasure(visibleVersion, "failure_points", aggregationFor("failure_points"));

  const changeFlow = (id: string) => {
    setActiveId(id);
    updateDataflowQuery(id);
    loadFlow(id);
  };

  const updateVisibleVersion = (patch: Partial<Version>) => {
    if (!visibleVersion) return;
    if (visibleVersion.id === proposed?.id) {
      setProposed((value) => value ? { ...value, ...patch } : value);
    } else {
      setCurrent((value) => value ? { ...value, ...patch } : value);
    }
  };

  const updateStage = (stageId: string, patch: Partial<Stage>) => {
    if (!visibleVersion) return;
    updateVisibleVersion({ stages: visibleVersion.stages.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage) });
  };

  const updateStageMeasure = (stageId: string, definition: MeasureDefinition, value: string) => {
    if (!visibleVersion) return;
    const existing = visibleVersion.measures.find((measure) => measure.stage_id === stageId && measure.measure_definition_id === definition.id);
    if (value === "") {
      updateVisibleVersion({ measures: visibleVersion.measures.filter((measure) => measure !== existing) });
      return;
    }
    const numericValue = Number(value);
    if (existing) {
      updateVisibleVersion({ measures: visibleVersion.measures.map((measure) => measure === existing ? { ...measure, numeric_value: numericValue, source: "estimated" } : measure) });
      return;
    }
    updateVisibleVersion({
      measures: [...visibleVersion.measures, {
        id: crypto.randomUUID(),
        measure_definition_id: definition.id,
        measure_key: definition.key,
        measure_name: definition.name,
        unit: definition.unit,
        value_type: definition.value_type,
        improvement_direction: definition.improvement_direction,
        stage_id: stageId,
        numeric_value: numericValue,
        text_value: null,
        source: "estimated",
        explanation: "",
      }],
    });
  };

  const saveLatest = async () => {
    if (!visibleVersion || !activeId) return;
    setStatus("saving");
    setMessage("");
    try {
      const saved = await api.updateVersion(activeId, visibleVersion);
      if (saved.id === proposed?.id) setProposed(saved);
      else setCurrent(saved);
      setSelectedId(saved.stages.find((stage) => stage.logical_key === selectedStage?.logical_key)?.id ?? null);
      setStatus("ready");
      setMessage("Latest version saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save the latest version");
    }
  };

  const createProposed = async () => {
    if (!activeId) return;
    setStatus("saving");
    try {
      const version = await api.cloneProposed(activeId);
      setProposed(version);
      setSelectedId(version.stages[0]?.id ?? null);
      setStatus("ready");
      setMessage("New latest version created");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not create the next version");
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
        monthly_budget: newDecision.monthly_budget,
      });
      const flows = await api.listDataflows();
      setDataflows(flows);
      setActiveId(created.dataflow_id);
      updateDataflowQuery(created.dataflow_id);
      setCreateOpen(false);
      setNewDecision({ name: "", description: "", business_goal: "", latency_target_minutes: 60, monthly_budget: 0 });
      await loadFlow(created.dataflow_id);
      setMessage("Decision created. Create the next version when you are ready to make changes.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not create the decision");
    }
  };

  const addStage = () => {
    if (!visibleVersion || !pendingStageType) return;
    const id = crypto.randomUUID();
    const stage: Stage = {
      id,
      logical_key: `${pendingStageType.key}_${id}`,
      stage_type_version_id: pendingStageType.version.id,
      position: visibleVersion.stages.length,
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
    updateVisibleVersion({ stages: [...visibleVersion.stages, stage] });
    setSelectedId(id);
  };

  const removeStage = (id: string) => {
    if (!visibleVersion) return;
    const stages = visibleVersion.stages.filter((stage) => stage.id !== id).map((stage, position) => ({ ...stage, position }));
    updateVisibleVersion({ stages, measures: visibleVersion.measures.filter((measure) => measure.stage_id !== id) });
    setSelectedId(stages[0]?.id ?? null);
  };

  const moveStage = (id: string, direction: -1 | 1) => {
    if (!visibleVersion) return;
    const stages = [...visibleVersion.stages];
    const index = stages.findIndex((stage) => stage.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= stages.length) return;
    [stages[index], stages[target]] = [stages[target], stages[index]];
    updateVisibleVersion({ stages: stages.map((stage, position) => ({ ...stage, position })) });
  };

  const saveAction = editable
    ? <button className="primary-button compact-button" onClick={saveLatest}>Save latest</button>
    : visibleVersion
      ? <button className="primary-button compact-button" onClick={createProposed}>Create next version</button>
      : null;

  if (status === "loading" && !current) {
    return <AppShell status={status}><div className="center-state"><div className="spinner" /><p>Loading decision canvas…</p></div></AppShell>;
  }

  return (
    <AppShell status={status} action={saveAction} activeDataflowId={activeId}>
      <header className="page-heading">
        <div><span>ARCHITECTURE WORKSPACE</span><h1>Decision canvas</h1><p>Inspect and shape the latest version of your decision architecture.</p></div>
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
              <span><strong>{item.name}</strong><small>{item.description || "No description"}</small><i>Latest version {latestVersionNumber(item) ?? "—"}</i></span>
            </button>)}
            {filteredDataflows.length === 0 && <p className="library-empty">No decisions match your search.</p>}
          </div>
          <button className="secondary-button library-add" onClick={() => setCreateOpen(true)}>+ Add decision</button>
        </aside>

        <div className="canvas-workspace">
        <section className="active-decision-bar">
          <div><span>ACTIVE DECISION</span><strong>{flow?.name}</strong><small>{flow?.description || "No description provided"}</small></div>
          <span className="version-line">Latest version {visibleVersion.version_number}</span>
        </section>
        <section className="canvas-version-bar">
          <div className="section-heading">
            <div><span>LATEST VERSION</span><h2>Version {visibleVersion.version_number}</h2><p>{visibleVersion.tags.length ? "Tags for this version" : "No tags added"}</p></div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
              {visibleVersion.tags.map((tag) => <i className="tag-pill" key={tag}>{tag}</i>)}
            </div>
          </div>
          <div className="project-fields">
            <label className="goal-input" style={{ gridColumn: "1 / -1" }}><span>Business objective</span><input value={visibleVersion.business_goal} disabled={!editable} onChange={(event) => updateVisibleVersion({ business_goal: event.target.value })} /></label>
          </div>
        </section>

        <section className="metrics" aria-label="Version totals">
          <article><span>Latency target</span>{editable ? <label className="metric-input"><input aria-label="Latency target in minutes" type="number" min="0" value={numberValue(visibleVersion.latency_target_minutes)} onChange={(event) => updateVisibleVersion({ latency_target_minutes: Number(event.target.value) })} /><select aria-label="Latency target unit" value="minutes" disabled><option value="minutes">minutes</option></select></label> : <strong>{formatValue(visibleVersion.latency_target_minutes, "minutes")}</strong>}<small className={numberValue(freshness) <= numberValue(visibleVersion.latency_target_minutes) ? "good" : "warning"}>Cumulative duration {formatValue(freshness, "minutes")}</small></article>
          <article><span>Monthly budget</span>{editable ? <label className="metric-input budget"><b>$</b><input aria-label="Monthly budget in USD" type="number" min="0" value={numberValue(visibleVersion.monthly_budget)} onChange={(event) => updateVisibleVersion({ monthly_budget: Number(event.target.value) })} /></label> : <strong>{formatValue(visibleVersion.monthly_budget, "USD/month")}</strong>}<small>Cumulative cost {formatValue(cost, "USD/month")}</small></article>
          <article><span>Failure points</span><strong>{formatValue(failurePoints, "count")}</strong><small>Cumulative across {visibleVersion.stages.length} stages</small></article>
          <article><span>Version state</span><strong className="capitalize">{visibleVersion.status}</strong><small>{visibleVersion.tags.join(", ") || "Untagged"}</small></article>
        </section>

        <div className="content-grid">
          <section className="pipeline-card">
            <div className="section-heading"><div><span>LATEST ARCHITECTURE</span><h2>Decision path</h2><p>Every stage belongs to version {visibleVersion.version_number}.</p></div><strong>{visibleVersion.stages.length} stages</strong></div>
            <div className="stage-list">
              {visibleVersion.stages.map((stage, index) => <div className="stage-row" key={stage.id}>
                <div className={`stage-card ${selectedId === stage.id ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => setSelectedId(stage.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(stage.id); }}>
                  <StageIcon stage={stage} />
                  <span className="stage-copy"><small>{String(index + 1).padStart(2, "0")} · {stage.stage_type_name}</small><strong>{stage.label}</strong><span>{stage.platform || "Platform not set"}</span></span>
                  <span className="stage-metrics"><span><small>Category</small><strong>{stage.category}</strong></span><span><small>State</small><strong className="capitalize">{visibleVersion.status}</strong></span></span>
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
              <section className="stage-measures">
                <div><span>STAGE MEASURES</span><small>These values roll up into the canvas totals.</small></div>
                <div className="stage-measure-grid">{measureDefinitions.map((definition) => {
                  const measure = visibleVersion.measures.find((item) => item.stage_id === selectedStage.id && item.measure_definition_id === definition.id);
                  return <label key={definition.id}><span>{definition.name}<small>{definition.unit}</small></span><input type="number" min="0" disabled={!editable} value={measure?.numeric_value ?? ""} placeholder="—" onChange={(event) => updateStageMeasure(selectedStage.id, definition, event.target.value)} /></label>;
                })}</div>
              </section>
              <label><span>Context note</span><textarea rows={5} disabled={!editable} value={selectedStage.note} onChange={(event) => updateStage(selectedStage.id, { note: event.target.value })} /></label>
              {editable && <button className="danger-button" onClick={() => removeStage(selectedStage.id)}>Remove stage</button>}
            </> : <div className="empty-details"><span>NO STAGE SELECTED</span><h2>Select a stage</h2><p>Choose any item in the decision path.</p></div>}
          </aside>
        </div>

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

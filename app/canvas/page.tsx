"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AppShell } from "@/app/components/app-shell";
import { StageIcon } from "@/lib/stage-icons";

type StageProperty = { id: string; name: string; value: string };
type StageKind = "source" | "transform" | "database" | "analytics" | "terminal";

type ProcessStage = {
  id: string;
  name: string;
  type: string;
  platform: string;
  iconKey: StageKind;
  color: string;
  properties: StageProperty[];
};

const stageTypes: { label: string; key: StageKind; color: string }[] = [
  { label: "Input", key: "source", color: "#3d68d7" },
  { label: "Transform", key: "transform", color: "#b45dcd" },
  { label: "Storage", key: "database", color: "#2f9b86" },
  { label: "Decision", key: "analytics", color: "#d79533" },
  { label: "Automation", key: "terminal", color: "#e26b55" },
];

const platforms = ["Salesforce", "HubSpot", "Snowflake", "Databricks", "dbt", "AWS", "Manual", "Other"];
const propertyPresets = ["Duration", "Cost", "Rows", "Owner", "SLA"];

const seedStages: ProcessStage[] = [
  {
    id: "capture-lead",
    name: "Capture lead",
    type: "Input",
    platform: "Salesforce",
    iconKey: "source",
    color: "#3d68d7",
    properties: [{ id: "p1", name: "Rows", value: "18,420 / day" }, { id: "p2", name: "Owner", value: "RevOps" }],
  },
  {
    id: "qualify-lead",
    name: "Qualify lead",
    type: "Decision",
    platform: "HubSpot",
    iconKey: "analytics",
    color: "#d79533",
    properties: [{ id: "p3", name: "Duration", value: "4 hrs" }, { id: "p4", name: "SLA", value: "Same day" }],
  },
  {
    id: "enrich-profile",
    name: "Enrich profile",
    type: "Transform",
    platform: "dbt",
    iconKey: "transform",
    color: "#b45dcd",
    properties: [{ id: "p5", name: "Cost", value: "$0.12 / run" }],
  },
  {
    id: "sync-warehouse",
    name: "Sync to warehouse",
    type: "Storage",
    platform: "Snowflake",
    iconKey: "database",
    color: "#2f9b86",
    properties: [{ id: "p6", name: "Duration", value: "18 min" }, { id: "p7", name: "Rows", value: "62,800" }],
  },
  {
    id: "activate-campaign",
    name: "Activate campaign",
    type: "Automation",
    platform: "HubSpot",
    iconKey: "terminal",
    color: "#e26b55",
    properties: [{ id: "p8", name: "Owner", value: "Marketing Ops" }],
  },
];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DecisionCanvasPage() {
  const [processName, setProcessName] = useState("Lead-to-campaign process");
  const [stages, setStages] = useState<ProcessStage[]>(seedStages);
  const [selectedId, setSelectedId] = useState(seedStages[2].id);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPropertyMenu, setShowPropertyMenu] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("decla-process-canvas");
      if (saved) {
        try {
          const draft = JSON.parse(saved) as { name?: string; stages?: ProcessStage[] };
          if (draft.name) setProcessName(draft.name);
          if (draft.stages?.length) {
            setStages(draft.stages);
            setSelectedId(draft.stages[0].id);
          }
        } catch {
          // A stale local draft should never prevent the canvas from opening.
        }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("decla-process-canvas", JSON.stringify({ name: processName, stages }));
  }, [hydrated, processName, stages]);

  const selectedStage = stages.find((stage) => stage.id === selectedId) ?? null;
  const totalProperties = useMemo(() => stages.reduce((total, stage) => total + stage.properties.length, 0), [stages]);

  function updateStage(patch: Partial<ProcessStage>) {
    if (!selectedStage) return;
    setStages((current) => current.map((stage) => stage.id === selectedStage.id ? { ...stage, ...patch } : stage));
  }

  function changeType(key: StageKind) {
    const next = stageTypes.find((item) => item.key === key) ?? stageTypes[0];
    updateStage({ type: next.label, iconKey: next.key, color: next.color });
  }

  function addStage(kind: (typeof stageTypes)[number]) {
    const next: ProcessStage = {
      id: createId("stage"),
      name: `New ${kind.label.toLowerCase()}`,
      type: kind.label,
      platform: "Manual",
      iconKey: kind.key,
      color: kind.color,
      properties: [],
    };
    setStages((current) => [...current, next]);
    setSelectedId(next.id);
    setShowAddMenu(false);
    setMessage("Stage added to the process");
  }

  function removeSelected() {
    if (!selectedStage) return;
    const next = stages.filter((stage) => stage.id !== selectedStage.id);
    setStages(next);
    setSelectedId(next[Math.max(0, stages.findIndex((stage) => stage.id === selectedStage.id) - 1)]?.id ?? null);
    setMessage("Stage removed");
  }

  function addProperty(name = "New property") {
    if (!selectedStage) return;
    const property = { id: createId("property"), name, value: "" };
    updateStage({ properties: [...selectedStage.properties, property] });
    setShowPropertyMenu(false);
  }

  function updateProperty(id: string, patch: Partial<StageProperty>) {
    if (!selectedStage) return;
    updateStage({ properties: selectedStage.properties.map((property) => property.id === id ? { ...property, ...patch } : property) });
  }

  function removeProperty(id: string) {
    if (!selectedStage) return;
    updateStage({ properties: selectedStage.properties.filter((property) => property.id !== id) });
  }

  function saveDraft() {
    window.localStorage.setItem("decla-process-canvas", JSON.stringify({ name: processName, stages }));
    setMessage("Draft saved locally");
  }

  return (
    <AppShell status="ready" action={<button className="toolbar-save" onClick={saveDraft}>Save draft <span>⌘ S</span></button>}>
      <div className="process-page">
        <header className="process-heading">
          <div>
            <div className="eyebrow-row"><span className="process-eyebrow">PROCESS CANVAS</span><span className="local-pill"><i /> Local draft</span></div>
            <input className="process-title-input" value={processName} onChange={(event) => setProcessName(event.target.value)} aria-label="Process name" />
            <p>Map how work moves from one business stage to the next.</p>
          </div>
          <div className="process-heading-actions">
            <button className="secondary-button" onClick={() => setMessage("Share link copied to clipboard")}>Share</button>
            <button className="primary-button" onClick={saveDraft}>Save changes</button>
          </div>
        </header>

        {message && <button className="process-toast" onClick={() => setMessage("")} aria-label="Dismiss message">{message}<span>×</span></button>}

        <div className="process-layout">
          <section className="process-canvas-panel">
            <div className="canvas-toolbar">
              <div className="canvas-toolbar-group">
                <button className="tool-button active" aria-label="Select tool">↖ <span>Select</span></button>
                <button className="tool-button" aria-label="Hand tool">✋ <span>Pan</span></button>
                <span className="toolbar-divider" />
                <div className="add-stage-wrap">
                  <button className="add-stage-button" onClick={() => setShowAddMenu((open) => !open)}>＋ Add stage</button>
                  {showAddMenu && <div className="floating-menu stage-menu">
                    <small>ADD A BUSINESS STAGE</small>
                    {stageTypes.map((kind) => <button key={kind.key} onClick={() => addStage(kind)}><span className="menu-color" style={{ background: kind.color }} />{kind.label}<span>+</span></button>)}
                  </div>}
                </div>
              </div>
              <div className="canvas-toolbar-group canvas-tools-right">
                <span className="canvas-stat"><strong>{stages.length}</strong> stages</span>
                <span className="canvas-stat"><strong>{totalProperties}</strong> properties</span>
                <span className="toolbar-divider" />
                <button className="zoom-button" onClick={() => setZoom((value) => Math.max(70, value - 10))}>−</button>
                <span className="zoom-value">{zoom}%</span>
                <button className="zoom-button" onClick={() => setZoom((value) => Math.min(130, value + 10))}>+</button>
                <button className="fit-button" onClick={() => setZoom(100)}>Fit</button>
              </div>
            </div>

            <div className="canvas-viewport">
              <div className="canvas-surface" style={{ "--canvas-zoom": zoom / 100 } as CSSProperties}>
                <div className="canvas-label"><span>TRIGGER</span><i /> PROCESS FLOW <i /><span>OUTCOME</span></div>
                <div className="flow-track">
                  {stages.map((stage, index) => <div className="flow-step" key={stage.id}>
                    <button className={`flow-node ${selectedId === stage.id ? "selected" : ""}`} style={{ "--node-accent": stage.color } as CSSProperties} onClick={() => setSelectedId(stage.id)} aria-label={`Select ${stage.name}`}>
                      <span className="flow-node-top"><small>0{index + 1}</small><span className="node-more">•••</span></span>
                      <span className="flow-node-icon"><StageIcon stage={{ label: stage.name, platform: stage.platform, stage_type_key: stage.iconKey, category: stage.type }} decorative={false} /></span>
                      <strong>{stage.name}</strong>
                      <span className="flow-node-meta"><span>{stage.type}</span><span>{stage.platform}</span></span>
                      {stage.properties.length > 0 && <span className="node-property-count">{stage.properties.length} {stage.properties.length === 1 ? "property" : "properties"}</span>}
                    </button>
                    {index < stages.length - 1 && <span className="flow-connector" aria-hidden="true"><i /></span>}
                  </div>)}
                  <button className="canvas-add-node" onClick={() => setShowAddMenu(true)}><span>＋</span><small>Add stage</small></button>
                </div>
                <div className="canvas-hint"><span>Tip</span> Select any stage to edit its details and add custom properties.</div>
              </div>
            </div>

            <div className="canvas-footer">
              <span><i className="legend-dot source" /> Input</span><span><i className="legend-dot transform" /> Transform</span><span><i className="legend-dot decision" /> Decision</span><span><i className="legend-dot output" /> Automation</span>
              <span className="canvas-footer-note">Changes are saved in this browser</span>
            </div>
          </section>

          <aside className="inspector-panel">
            {selectedStage ? <>
              <div className="inspector-header"><div><span className="process-eyebrow">STAGE PROPERTIES</span><h2>Edit stage</h2></div><button className="icon-button" onClick={removeSelected} aria-label="Delete selected stage">⌫</button></div>
              <div className="inspector-stage-banner" style={{ "--node-accent": selectedStage.color } as CSSProperties}><span className="inspector-icon"><StageIcon stage={{ label: selectedStage.name, platform: selectedStage.platform, stage_type_key: selectedStage.iconKey, category: selectedStage.type }} decorative={false} /></span><div><strong>{selectedStage.name}</strong><small>Stage {String(stages.findIndex((stage) => stage.id === selectedStage.id) + 1).padStart(2, "0")} of {stages.length}</small></div></div>

              <div className="inspector-form">
                <label><span>Name</span><input value={selectedStage.name} onChange={(event) => updateStage({ name: event.target.value })} placeholder="Name this stage" /></label>
                <label><span>Type</span><select value={selectedStage.iconKey} onChange={(event) => changeType(event.target.value as StageKind)}>{stageTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
                <label><span>Platform</span><select value={selectedStage.platform} onChange={(event) => updateStage({ platform: event.target.value })}>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
              </div>

              <div className="properties-section"><div className="properties-heading"><div><span className="process-eyebrow">CUSTOM DATA</span><strong>Properties</strong></div><div className="property-add-wrap"><button className="add-property-button" onClick={() => setShowPropertyMenu((open) => !open)}>＋ Add property</button>{showPropertyMenu && <div className="floating-menu property-menu"><small>CHOOSE A PROPERTY</small>{propertyPresets.map((preset) => <button key={preset} onClick={() => addProperty(preset)}>{preset}<span>+</span></button>)}<button onClick={() => addProperty()}><em>＋</em> Custom property</button></div>}</div></div>
                <p className="properties-help">Add the metrics your team uses to describe this stage.</p>
                <div className="property-list">
                  {selectedStage.properties.map((property) => <div className="property-row" key={property.id}><input value={property.name} onChange={(event) => updateProperty(property.id, { name: event.target.value })} aria-label="Property name" /><span>:</span><input value={property.value} onChange={(event) => updateProperty(property.id, { value: event.target.value })} placeholder="Add value" aria-label={`${property.name} value`} /><button onClick={() => removeProperty(property.id)} aria-label={`Remove ${property.name} property`}>×</button></div>)}
                  {selectedStage.properties.length === 0 && <div className="properties-empty"><span>⌁</span><p>No custom properties yet.<br />Add duration, cost, rows, or anything useful.</p></div>}
                </div>
              </div>
              <label className="notes-field"><span>Notes <em>Optional</em></span><textarea placeholder="Add context for your team..." rows={3} /></label>
            </> : <div className="inspector-empty"><span>◎</span><h2>Select a stage</h2><p>Choose a stage on the canvas to see and edit its properties.</p></div>}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

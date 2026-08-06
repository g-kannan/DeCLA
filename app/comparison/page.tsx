"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/app/components/app-shell";
import { DataflowPicker } from "@/app/components/dataflow-picker";
import { api, type Comparison, type DataflowSummary, type Stage } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { StageIcon } from "@/lib/stage-icons";

type LoadStatus = "loading" | "saving" | "ready" | "error";

function updateDataflowQuery(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("dataflow", id);
  window.history.replaceState({}, "", url);
}

function percentage(value: string | number | null) {
  if (value == null) return "—";
  return `${Math.abs(Number(value)).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function CompareStage({ stage, index, change }: { stage: Stage | null; index: number; change: string }) {
  if (!stage) return <div className="compare-stage empty"><span className="missing-stage">No stage</span></div>;
  return <div className="compare-stage"><span className="compare-index">{String(index + 1).padStart(2, "0")}</span><StageIcon stage={stage} /><span><strong>{stage.label}</strong><small>{stage.platform || stage.stage_type_name}</small></span><i className={`change-pill ${change}`}>{change}</i></div>;
}

export default function ComparisonPage() {
  const [dataflows, setDataflows] = useState<DataflowSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");

  const loadComparison = useCallback(async (id: string) => {
    setStatus("loading");
    setMessage("");
    try {
      setComparison(await api.getComparison(id));
      setStatus("ready");
    } catch (error) {
      setComparison(null);
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "A comparison is not available");
    }
  }, []);

  useEffect(() => {
    api.listDataflows()
      .then((items) => {
        setDataflows(items);
        const requestedId = new URLSearchParams(window.location.search).get("dataflow");
        const initial = items.find((item) => item.id === requestedId) ?? items[0];
        if (!initial) {
          setStatus("ready");
          return;
        }
        setActiveId(initial.id);
        updateDataflowQuery(initial.id);
        return loadComparison(initial.id);
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not connect to the API");
      });
  }, [loadComparison]);

  const changeDataflow = (id: string) => {
    setActiveId(id);
    updateDataflowQuery(id);
    loadComparison(id);
  };

  const publish = async () => {
    if (!comparison) return;
    setStatus("saving");
    setMessage("");
    try {
      await api.publish(activeId, comparison.proposed.id);
      await loadComparison(activeId);
      setMessage("Proposed version published");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not publish the proposed version");
    }
  };

  const promote = async () => {
    if (!comparison) return;
    setStatus("saving");
    setMessage("");
    try {
      await api.promote(activeId);
      await loadComparison(activeId);
      setMessage("Proposed version promoted to current");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not promote the proposed version");
    }
  };

  const better = comparison?.measures.filter((item) => item.assessment === "better").length ?? 0;
  const worse = comparison?.measures.filter((item) => item.assessment === "worse").length ?? 0;
  const unchanged = comparison?.measures.filter((item) => item.assessment === "unchanged" || item.assessment === "not_comparable").length ?? 0;
  const changedStages = comparison?.stage_differences.filter((item) => item.change !== "unchanged") ?? [];
  const action = comparison?.proposed.status === "draft"
    ? <button className="primary-button compact-button" onClick={publish}>Publish proposal</button>
    : comparison?.proposed.status === "published"
      ? <button className="primary-button compact-button" onClick={promote}>Promote to current</button>
      : null;

  return (
    <AppShell status={status} action={action} activeDataflowId={activeId}>
      <header className="page-heading">
        <div><span>DECISION IMPACT</span><h1>Performance comparison</h1><p>Compare the current architecture with its proposed replacement.</p></div>
      </header>

      {dataflows.length > 0 && <DataflowPicker dataflows={dataflows} activeId={activeId} onChange={changeDataflow} hint={comparison ? `Version ${comparison.current.version_number} → ${comparison.proposed.version_number}` : "Comparison unavailable"} />}
      {message && <div className={`notice ${status === "error" ? "error" : ""}`}>{message}</div>}
      {status === "loading" && !comparison && <div className="center-state compact-state"><div className="spinner" /><p>Loading comparison…</p></div>}
      {status !== "loading" && dataflows.length === 0 && <section className="empty-page compact-state"><h1>No decisions yet</h1><p>Create a decision before comparing versions.</p></section>}
      {status !== "loading" && dataflows.length > 0 && !comparison && <section className="empty-comparison"><span>COMPARISON UNAVAILABLE</span><h2>Create a proposed version first</h2><p>The selected decision needs both a current and proposed version before its measures and stages can be compared.</p></section>}

      {comparison && <>
        <section className="comparison-summary">
          <article className="version-summary"><span>CURRENT</span><strong>Version {comparison.current.version_number}</strong><p>{comparison.current.version_name}</p><small>{comparison.current.stages.length} stages</small></article>
          <div className="comparison-arrow" aria-hidden="true">→</div>
          <article className="version-summary proposed"><span>PROPOSED</span><strong>Version {comparison.proposed.version_number}</strong><p>{comparison.proposed.version_name}</p><small>{comparison.proposed.stages.length} stages</small></article>
          <div className="impact-summary"><div><strong className="good">{better}</strong><span>Improved</span></div><div><strong className="bad">{worse}</strong><span>Regressed</span></div><div><strong>{unchanged}</strong><span>Unchanged</span></div></div>
        </section>

        <section className="comparison-card standalone-comparison">
          <div className="section-heading"><div><span>MEASURABLE IMPACT</span><h2>Measure comparison</h2><p>Improvement is calculated using each measure’s configured direction.</p></div><strong>{comparison.measures.length} measures</strong></div>
          <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Measure</th><th>Current</th><th>Proposed</th><th>Improvement</th><th>Assessment</th></tr></thead><tbody>
            {comparison.measures.map((measure) => <tr key={measure.definition_id}><td><strong>{measure.name}</strong><small>{measure.unit} · {measure.direction.replaceAll("_", " ")}</small></td><td>{formatValue(measure.current_value, measure.unit)}</td><td>{formatValue(measure.proposed_value, measure.unit)}</td><td>{percentage(measure.percentage_improvement)}</td><td><i className={`assessment ${measure.assessment}`}>{measure.assessment.replaceAll("_", " ")}</i></td></tr>)}
          </tbody></table></div>
        </section>

        <section className="side-by-side-card stage-change-card">
          <div className="section-heading"><div><span>ARCHITECTURE CHANGES</span><h2>Changed stages</h2><p>Stages matched by their stable logical key.</p></div><strong>{changedStages.length} changes</strong></div>
          {changedStages.length ? <div className="compare-lanes">
            <div className="compare-lane-heading"><span>CURRENT</span><strong>Version {comparison.current.version_number}</strong></div><div className="compare-lane-heading proposed"><span>PROPOSED</span><strong>Version {comparison.proposed.version_number}</strong></div>
            {changedStages.map((difference, index) => <div className={`compare-stage-row ${difference.change}`} key={difference.logical_key}><CompareStage stage={difference.current_stage} index={index} change={difference.change} /><CompareStage stage={difference.proposed_stage} index={index} change={difference.change} /></div>)}
          </div> : <div className="no-changes"><strong>No stage changes</strong><p>The current and proposed decision paths are identical.</p></div>}
        </section>
      </>}
    </AppShell>
  );
}

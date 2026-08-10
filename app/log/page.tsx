"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/app/components/app-shell";
import { readCanvasVersions, writeCanvasDraft, type CanvasVersion } from "@/lib/local-canvas";
import { StageIcon } from "@/lib/stage-icons";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function DecisionLogPage() {
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const selected = versions.find((version) => version.id === selectedId) ?? versions[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const localVersions = readCanvasVersions();
      setVersions(localVersions);
      setSelectedId(localVersions[0]?.id ?? "");
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function restore(version: CanvasVersion) {
    writeCanvasDraft({ name: version.name, status: version.status || "draft", environment: version.environment || "development", goLiveDate: version.goLiveDate || "", budget: version.budget || "", budgetCurrency: version.budgetCurrency || "USD", sla: version.sla || "", slaUnit: version.slaUnit || "days", stages: version.stages });
    window.location.href = "/canvas";
  }

  return (
    <AppShell status="ready">
      <header className="page-heading">
        <div><span>VERSION HISTORY</span><h1>Decision log</h1><p>Review saved versions of this decision canvas and restore an earlier process.</p></div>
        <Link className="primary-button detail-link" href="/canvas">Open canvas</Link>
      </header>

      {!hydrated && <div className="center-state compact-state"><div className="spinner" /><p>Loading local history...</p></div>}
      {hydrated && !versions.length && <section className="empty-comparison"><span>NO SAVED VERSIONS</span><h2>Your decision history starts here</h2><p>Save a version from the canvas to track previous process shapes and compare changes over time.</p><Link className="primary-button detail-link" href="/canvas">Go to canvas</Link></section>}

      {selected && <div className="log-layout">
        <section className="history-card">
          <div className="section-heading"><div><span>LOCAL VERSIONS</span><h2>Previous canvases</h2><p>Newest version first.</p></div><strong>{versions.length}</strong></div>
          <ol className="version-timeline">
            {versions.map((version) => <li key={version.id}>
              <i className="timeline-dot" />
              <button className={version.id === selected.id ? "active" : ""} onClick={() => setSelectedId(version.id)}>
                <span className="timeline-copy"><b>Version {version.version}</b><small>{version.summary}</small><span className="timeline-meta"><i className="status-pill published">local</i>{(version.tags ?? []).map((tag) => <i className="tag-pill" key={tag}>{tag}</i>)}</span></span>
                <span className="timeline-counts"><b>{version.stages.length}</b><small>stages</small></span>
              </button>
            </li>)}
          </ol>
        </section>

        <aside className="history-detail">
          <div className="history-detail-head"><div><span>VERSION {selected.version}</span><h2>{selected.name || "Untitled decision canvas"}</h2></div><i className="status-pill published">saved locally</i></div>
          <dl className="history-facts"><div><dt>Created</dt><dd>{formatDate(selected.createdAt)}</dd></div><div><dt>Status</dt><dd className="capitalize">{(selected.status || "draft").replace("-", " ")}</dd></div><div><dt>Environment</dt><dd className="capitalize">{selected.environment || "development"}</dd></div><div><dt>Go-live target</dt><dd>{selected.goLiveDate ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${selected.goLiveDate}T00:00:00`)) : "Not set"}</dd></div><div><dt>Budget</dt><dd>{selected.budget ? `${selected.budgetCurrency || "USD"} ${selected.budget}` : "Not set"}</dd></div><div><dt>SLA</dt><dd>{selected.sla ? `${selected.sla} ${selected.slaUnit || "days"}` : "Not set"}</dd></div><div><dt>Stages</dt><dd>{selected.stages.length}</dd></div><div><dt>Properties</dt><dd>{selected.stages.reduce((sum, stage) => sum + stage.properties.length, 0)}</dd></div></dl>
          <div className="history-context"><span>CHANGE SUMMARY</span><p>{selected.summary}</p></div><div className="history-context"><span>TAGS</span><p>{(selected.tags ?? []).join(" · ") || "No tags added"}</p></div>
          <div className="history-stages"><div><h3>Decision path</h3><span>{selected.stages.length} stages</span></div>{selected.stages.map((stage, index) => <article key={stage.id}><span className="stage-index">{String(index + 1).padStart(2, "0")}</span><StageIcon stage={{ label: stage.name, platform: stage.platform, stage_type_key: stage.iconKey, category: stage.type }} /><span><strong>{stage.name}</strong><small>{stage.type} · {stage.platform} · {stage.properties.length} properties</small></span></article>)}</div>
          <button className="secondary-button detail-link" onClick={() => restore(selected)}>Restore this version</button>
        </aside>
      </div>}
    </AppShell>
  );
}

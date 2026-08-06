"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/app/components/app-shell";
import { DataflowPicker } from "@/app/components/dataflow-picker";
import { api, type DataflowSummary, type Version } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { StageIcon } from "@/lib/stage-icons";

type LoadStatus = "loading" | "ready" | "error";

function updateDataflowQuery(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("dataflow", id);
  window.history.replaceState({}, "", url);
}

export default function DecisionLogPage() {
  const [dataflows, setDataflows] = useState<DataflowSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("");

  const loadVersions = useCallback(async (id: string) => {
    setStatus("loading");
    setMessage("");
    try {
      const items = await api.listVersions(id);
      const ordered = [...items].sort((a, b) => b.version_number - a.version_number);
      setVersions(ordered);
      setSelectedId(ordered[0]?.id ?? "");
      setStatus("ready");
    } catch (error) {
      setVersions([]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load the decision log");
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
        return loadVersions(initial.id);
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not connect to the API");
      });
  }, [loadVersions]);

  const changeDataflow = (id: string) => {
    setActiveId(id);
    updateDataflowQuery(id);
    loadVersions(id);
  };

  const selected = versions.find((version) => version.id === selectedId) ?? versions[0];

  return (
    <AppShell status={status} activeDataflowId={activeId}>
      <header className="page-heading">
        <div><span>VERSION HISTORY</span><h1>Decision log</h1><p>Review every recorded version and the context behind each architecture decision.</p></div>
      </header>

      {dataflows.length > 0 && <DataflowPicker dataflows={dataflows} activeId={activeId} onChange={changeDataflow} hint={`${versions.length} version${versions.length === 1 ? "" : "s"}`} />}
      {message && <div className="notice error">{message}</div>}
      {status === "loading" && versions.length === 0 && <div className="center-state compact-state"><div className="spinner" /><p>Loading decision log…</p></div>}
      {status !== "loading" && dataflows.length === 0 && <section className="empty-page compact-state"><h1>No decisions yet</h1><p>Create a decision before reviewing its history.</p></section>}

      {selected && <div className="log-layout">
        <section className="history-card">
          <div className="section-heading"><div><span>VERSIONS</span><h2>Recorded history</h2><p>Newest version first.</p></div><strong>{versions.length}</strong></div>
          <ol className="version-timeline">
            {versions.map((version) => <li key={version.id}>
              <i className="timeline-dot" />
              <button className={version.id === selected.id ? "active" : ""} onClick={() => setSelectedId(version.id)}>
                <span className="timeline-copy">
                  <b>Version {version.version_number}</b>
                  <small>{version.change_summary || "No change summary"}</small>
                  <span className="timeline-meta"><i className={`status-pill ${version.status}`}>{version.status}</i>{version.tags.map((tag) => <i className="tag-pill" key={tag}>{tag}</i>)}</span>
                </span>
                <span className="timeline-counts"><b>{version.stages.length}</b><small>stages</small></span>
              </button>
            </li>)}
          </ol>
        </section>

        <aside className="history-detail">
          <div className="history-detail-head"><div><span>VERSION {selected.version_number}</span><h2>{selected.version_name || `Version ${selected.version_number}`}</h2></div><i className={`status-pill ${selected.status}`}>{selected.status}</i></div>
          <dl className="history-facts">
            <div><dt>Created</dt><dd>{formatDate(selected.created_at)}</dd></div>
            <div><dt>Published</dt><dd>{formatDate(selected.published_at)}</dd></div>
            <div><dt>Tags</dt><dd>{selected.tags.join(", ") || "Untagged"}</dd></div>
            <div><dt>Stages</dt><dd>{selected.stages.length}</dd></div>
          </dl>
          <div className="history-context"><span>CHANGE SUMMARY</span><p>{selected.change_summary || "No change summary was recorded."}</p></div>
          <div className="history-context"><span>BUSINESS OBJECTIVE</span><p>{selected.business_goal || "No business objective was recorded."}</p></div>
          <div className="history-stages">
            <div><h3>Decision path</h3><span>{selected.stages.length} stages</span></div>
            {selected.stages.map((stage, index) => <article key={stage.id}><span className="stage-index">{String(index + 1).padStart(2, "0")}</span><StageIcon stage={stage} /><span><strong>{stage.label}</strong><small>{stage.platform || stage.stage_type_name}</small></span></article>)}
          </div>
          <Link className="secondary-button detail-link" href={`/canvas?dataflow=${activeId}`}>Open latest canvas</Link>
        </aside>
      </div>}
    </AppShell>
  );
}

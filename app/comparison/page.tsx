"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/app/components/app-shell";
import { readCanvasVersions, type CanvasStage, type CanvasVersion } from "@/lib/local-canvas";
import { StageIcon } from "@/lib/stage-icons";

type StageChange = { key: string; change: "added" | "removed" | "modified" | "unchanged"; current: CanvasStage | null; proposed: CanvasStage | null };

function numericValue(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function aggregateProperties(version: CanvasVersion) {
  const values = new Map<string, CanvasVersion["stages"][number]["properties"]>();
  version.stages.forEach((stage) => stage.properties.forEach((property) => values.set(property.name, [...(values.get(property.name) ?? []), property])));
  return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, properties]) => {
    const items = properties.map((property) => property.value);
    const numbers = items.map(numericValue);
    const metadata = properties.find((property) => property.kind || property.unit || property.currency) ?? properties[0];
    const allNumeric = numbers.every((item) => item !== null) && numbers.length > 0;
    const numericTotal = numbers.reduce<number>((sum, item) => sum + (item ?? 0), 0);
    const formattedTotal = numericTotal.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const prefix = metadata.currency ? `${metadata.currency} ` : "";
    const suffix = metadata.unit ?? "";
    return { name, items, value: allNumeric ? `${prefix}${formattedTotal}${suffix ? ` ${suffix}` : ""}` : [...new Set(items.filter(Boolean))].join(" · ") || "—", numeric: allNumeric ? numericTotal : null };
  });
}

function stageChanges(current: CanvasVersion, proposed: CanvasVersion) {
  const currentMap = new Map(current.stages.map((stage) => [stage.id, stage]));
  const proposedMap = new Map(proposed.stages.map((stage) => [stage.id, stage]));
  const keys = [...new Set([...current.stages.map((stage) => stage.id), ...proposed.stages.map((stage) => stage.id)])];
  return keys.map((key): StageChange => {
    const before = currentMap.get(key) ?? null;
    const after = proposedMap.get(key) ?? null;
    const change = !before ? "added" : !after ? "removed" : JSON.stringify(before) === JSON.stringify(after) ? "unchanged" : "modified";
    return { key, change, current: before, proposed: after };
  });
}

function StageSide({ stage, empty }: { stage: CanvasStage | null; empty: string }) {
  if (!stage) return <div className="compare-stage empty"><span className="missing-stage">{empty}</span></div>;
  return <div className="compare-stage"><StageIcon stage={{ label: stage.name, platform: stage.platform, stage_type_key: stage.iconKey, category: stage.type }} /><span><strong>{stage.name}</strong><small>{stage.type} · {stage.platform}</small></span><em>{stage.properties.length} props</em></div>;
}

export default function ComparisonPage() {
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [proposedId, setProposedId] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const localVersions = readCanvasVersions();
      setVersions(localVersions);
      setCurrentId(localVersions[1]?.id ?? localVersions[0]?.id ?? "");
      setProposedId(localVersions[0]?.id ?? "");
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const current = versions.find((version) => version.id === currentId) ?? null;
  const proposed = versions.find((version) => version.id === proposedId) ?? null;
  const currentProperties = useMemo(() => current ? aggregateProperties(current) : [], [current]);
  const proposedProperties = useMemo(() => proposed ? aggregateProperties(proposed) : [], [proposed]);
  const propertyNames = useMemo(() => [...new Set([...currentProperties.map((item) => item.name), ...proposedProperties.map((item) => item.name)])].sort(), [currentProperties, proposedProperties]);
  const differences = current && proposed ? stageChanges(current, proposed) : [];
  const changedStages = differences.filter((item) => item.change !== "unchanged");

  function propertyFor(items: ReturnType<typeof aggregateProperties>, name: string) {
    return items.find((item) => item.name === name);
  }

  return (
    <AppShell status="ready">
      <header className="page-heading"><div><span>DECISION IMPACT</span><h1>Comparison</h1><p>Compare every property aggregate and stage change between saved canvas versions.</p></div><Link className="secondary-button detail-link" href="/canvas">Open canvas</Link></header>

      {!hydrated && <div className="center-state compact-state"><div className="spinner" /><p>Loading local versions...</p></div>}
      {hydrated && versions.length < 2 && <section className="empty-comparison"><span>NOT ENOUGH VERSIONS</span><h2>Save two versions to compare</h2><p>Make a change in the decision canvas, then save another version to see property aggregates and stage diffs here.</p><Link className="primary-button detail-link" href="/canvas">Go to canvas</Link></section>}

      {hydrated && versions.length >= 2 && current && proposed && <>
        <section className="local-compare-controls"><label><span>BASELINE</span><select value={currentId} onChange={(event) => setCurrentId(event.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>Version {version.version} · {version.name || "Untitled"}</option>)}</select></label><span className="comparison-arrow">→</span><label><span>COMPARE TO</span><select value={proposedId} onChange={(event) => setProposedId(event.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>Version {version.version} · {version.name || "Untitled"}</option>)}</select></label></section>
        <section className="comparison-summary"><article className="version-summary"><span>BASELINE</span><strong>Version {current.version}</strong><p>{current.name || "Untitled decision canvas"}</p><small>{current.stages.length} stages · {current.budget ? `${current.budgetCurrency || "USD"} ${current.budget}` : "No budget"} · SLA {current.sla ? `${current.sla} ${current.slaUnit || "days"}` : "not set"}</small></article><div className="comparison-arrow" aria-hidden="true">→</div><article className="version-summary proposed"><span>COMPARE TO</span><strong>Version {proposed.version}</strong><p>{proposed.name || "Untitled decision canvas"}</p><small>{proposed.stages.length} stages · {proposed.budget ? `${proposed.budgetCurrency || "USD"} ${proposed.budget}` : "No budget"} · SLA {proposed.sla ? `${proposed.sla} ${proposed.slaUnit || "days"}` : "not set"}</small></article><div className="impact-summary"><div><strong className="good">{changedStages.filter((item) => item.change === "added").length}</strong><span>Added</span></div><div><strong className="bad">{changedStages.filter((item) => item.change === "removed").length}</strong><span>Removed</span></div><div><strong>{changedStages.filter((item) => item.change === "modified").length}</strong><span>Modified</span></div></div></section>

        <section className="comparison-card standalone-comparison"><div className="section-heading"><div><span>PROPERTY AGGREGATES</span><h2>All property comparison</h2><p>Values are aggregated across every stage. Numeric values are summed; text values are grouped.</p></div><strong>{propertyNames.length} properties</strong></div><div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Property</th><th>Baseline</th><th>Compare to</th><th>Difference</th></tr></thead><tbody>{propertyNames.map((name) => { const before = propertyFor(currentProperties, name); const after = propertyFor(proposedProperties, name); const delta = before?.numeric !== null && before?.numeric !== undefined && after?.numeric !== null && after?.numeric !== undefined ? after.numeric - before.numeric : null; return <tr key={name}><td><strong>{name}</strong><small>{(before?.items.length ?? after?.items.length ?? 0)} stage values</small></td><td>{before?.value ?? "—"}</td><td>{after?.value ?? "—"}</td><td>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</td></tr>; })}</tbody></table></div></section>

        <section className="side-by-side-card stage-change-card"><div className="section-heading"><div><span>STAGE DIFF</span><h2>Stage changes</h2><p>Stages are matched by their local stage id.</p></div><strong>{changedStages.length} changes</strong></div>{changedStages.length ? <div className="compare-lanes"><div className="compare-lane-heading"><span>BASELINE</span><strong>Version {current.version}</strong></div><div className="compare-lane-heading proposed"><span>COMPARE TO</span><strong>Version {proposed.version}</strong></div>{changedStages.map((difference) => <div className={`compare-stage-row ${difference.change}`} key={difference.key}><StageSide stage={difference.current} empty="Stage not present" /><StageSide stage={difference.proposed} empty="Stage not present" /></div>)}</div> : <div className="no-changes"><strong>No stage changes</strong><p>These two saved versions have the same stage structure.</p></div>}</section>
      </>}
    </AppShell>
  );
}

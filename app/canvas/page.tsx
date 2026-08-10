"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AppShell } from "@/app/components/app-shell";
import { CANVAS_STORAGE_KEY, nextCanvasVersion, readCanvasVersions, writeCanvasDraft, writeCanvasVersions, type CanvasEnvironment, type CanvasStage, type CanvasStatus, type CanvasVersion, type PropertyKind, type StageProperty } from "@/lib/local-canvas";
import { StageIcon } from "@/lib/stage-icons";

type StageKind = "source" | "transform" | "database" | "analytics" | "terminal";

const stageTypes: { label: string; key: StageKind; color: string }[] = [
  { label: "Input", key: "source", color: "#2A2ACF" },
  { label: "Transform", key: "transform", color: "#F36A10" },
  { label: "Storage", key: "database", color: "#2A2ACF" },
  { label: "Decision", key: "analytics", color: "#F36A10" },
  { label: "Automation", key: "terminal", color: "#2A2ACF" },
];

const platforms = ["Salesforce", "HubSpot", "Snowflake", "Databricks", "dbt", "AWS", "Other"];
const durationUnits = ["mins", "hours", "days"];
const currencies = ["USD", "EUR", "GBP", "INR"];
const propertyPresets: { label: string; kind: PropertyKind; unit?: string; currency?: string }[] = [
  { label: "Duration", kind: "duration", unit: "hours" },
  { label: "Cost", kind: "cost", currency: "USD" },
  { label: "Rows", kind: "rows", unit: "rows" },
  { label: "Owner", kind: "owner" },
  { label: "SLA", kind: "sla", unit: "days" },
];
const statusOptions: { value: CanvasStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "under-review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "archived", label: "Archived" },
];
const versionTagOptions = ["Current", "Proposed", "Draft", "Under review", "Approved"];
const environmentOptions: { value: CanvasEnvironment; label: string }[] = [
  { value: "development", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Production" },
];
const seedStages: CanvasStage[] = [
  {
    id: "capture-lead",
    name: "Capture lead",
    type: "Input",
    platform: "Salesforce",
    iconKey: "source",
    color: "#2A2ACF",
    properties: [{ id: "p1", name: "Rows", value: "18,420", kind: "rows", unit: "rows/day" }, { id: "p2", name: "Owner", value: "RevOps", kind: "owner" }],
  },
  {
    id: "qualify-lead",
    name: "Qualify lead",
    type: "Decision",
    platform: "HubSpot",
    iconKey: "analytics",
    color: "#F36A10",
    properties: [{ id: "p3", name: "Duration", value: "4", kind: "duration", unit: "hours" }, { id: "p4", name: "SLA", value: "1", kind: "sla", unit: "days" }],
  },
  {
    id: "enrich-profile",
    name: "Enrich profile",
    type: "Transform",
    platform: "dbt",
    iconKey: "transform",
    color: "#F36A10",
    properties: [{ id: "p5", name: "Cost", value: "12", kind: "cost", currency: "USD" }],
  },
  {
    id: "sync-warehouse",
    name: "Sync to warehouse",
    type: "Storage",
    platform: "Snowflake",
    iconKey: "database",
    color: "#2A2ACF",
    properties: [{ id: "p6", name: "Duration", value: "18", kind: "duration", unit: "mins" }, { id: "p7", name: "Rows", value: "62,800", kind: "rows", unit: "rows" }],
  },
  {
    id: "activate-campaign",
    name: "Activate campaign",
    type: "Automation",
    platform: "HubSpot",
    iconKey: "terminal",
    color: "#2A2ACF",
    properties: [{ id: "p8", name: "Owner", value: "Marketing Ops", kind: "owner" }],
  },
];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function numericValue(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function durationInMinutes(property: StageProperty) {
  const value = numericValue(property.value);
  if (property.unit === "days") return value * 24 * 60;
  if (property.unit === "hours") return value * 60;
  return value;
}

function formatDuration(minutes: number) {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} days`;
  if (minutes >= 60) return `${Number((minutes / 60).toFixed(1))} hours`;
  return `${Number(minutes.toFixed(1))} mins`;
}

function targetInMinutes(value: string, unit: string) {
  return durationInMinutes({ id: "target", name: "SLA", value, kind: "sla", unit });
}

function daysUntil(date: string) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatShortDate(date: string) {
  if (!date) return "Not set";
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function propertyKind(property: StageProperty): PropertyKind {
  if (property.kind) return property.kind;
  const name = property.name.toLowerCase();
  if (name.includes("duration")) return "duration";
  if (name.includes("cost")) return "cost";
  if (name.includes("row")) return "rows";
  if (name.includes("owner")) return "owner";
  if (name.includes("sla")) return "sla";
  return "custom";
}

type SearchableOption = { value: string; label: string };

function SearchableSelect({ value, options, onChange, ariaLabel, className = "" }: { value: string; options: SearchableOption[]; onChange: (value: string) => void; ariaLabel: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value)?.label ?? value;
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return <div ref={wrapRef} className={`searchable-select ${className}`.trim()}><button type="button" className="searchable-select-trigger" onClick={() => { setOpen((current) => !current); setQuery(""); }} aria-label={ariaLabel} aria-expanded={open}>{selected || "Select..."}<span>⌄</span></button>{open && <div className="searchable-select-menu"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} placeholder="Search..." aria-label={`Search ${ariaLabel}`} />{filtered.length ? <div className="searchable-select-options">{filtered.map((option) => <button type="button" key={option.value} className={option.value === value ? "selected" : ""} onClick={() => { onChange(option.value); setOpen(false); setQuery(""); }}>{option.label}</button>)}</div> : <small className="searchable-select-empty">No matches</small>}</div>}</div>;
}

export default function DecisionCanvasPage() {
  const [processName, setProcessName] = useState("");
  const [projectStatus, setProjectStatus] = useState<CanvasStatus>("draft");
  const [environment, setEnvironment] = useState<CanvasEnvironment>("development");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [projectBudget, setProjectBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [projectSla, setProjectSla] = useState("");
  const [projectSlaUnit, setProjectSlaUnit] = useState("days");
  const [stages, setStages] = useState<CanvasStage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPropertyMenu, setShowPropertyMenu] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState<"select" | "pan">("select");
  const [isPanning, setIsPanning] = useState(false);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [versionTags, setVersionTags] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(CANVAS_STORAGE_KEY);
      const localVersions = readCanvasVersions();
      setVersions(localVersions);
      setVersionTags(localVersions[0]?.tags ?? []);
      if (saved) {
        try {
          const draft = JSON.parse(saved) as { name?: string; status?: CanvasStatus; environment?: CanvasEnvironment; goLiveDate?: string; budget?: string; budgetCurrency?: string; sla?: string; slaUnit?: string; stages?: CanvasStage[] };
          if (draft.name) setProcessName(draft.name);
          if (draft.status && statusOptions.some((option) => option.value === draft.status)) setProjectStatus(draft.status);
          if (draft.environment && environmentOptions.some((option) => option.value === draft.environment)) setEnvironment(draft.environment);
          if (draft.goLiveDate !== undefined) setGoLiveDate(draft.goLiveDate);
          if (draft.budget !== undefined) setProjectBudget(draft.budget);
          if (draft.budgetCurrency) setBudgetCurrency(draft.budgetCurrency);
          if (draft.sla !== undefined) setProjectSla(draft.sla);
          if (draft.slaUnit) setProjectSlaUnit(draft.slaUnit);
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
    writeCanvasDraft({ name: processName, status: projectStatus, environment, goLiveDate, budget: projectBudget, budgetCurrency, sla: projectSla, slaUnit: projectSlaUnit, stages });
  }, [budgetCurrency, environment, goLiveDate, hydrated, processName, projectBudget, projectSla, projectSlaUnit, projectStatus, stages]);

  const selectedStage = stages.find((stage) => stage.id === selectedId) ?? null;
  const totalProperties = useMemo(() => stages.reduce((total, stage) => total + stage.properties.length, 0), [stages]);
  const totalCost = useMemo(() => stages.reduce((total, stage) => total + stage.properties.filter((property) => propertyKind(property) === "cost").reduce((sum, property) => sum + numericValue(property.value), 0), 0), [stages]);
  const totalLatencyMinutes = useMemo(() => stages.reduce((total, stage) => total + stage.properties.filter((property) => propertyKind(property) === "duration").reduce((sum, property) => sum + durationInMinutes(property), 0), 0), [stages]);
  const budgetTotal = numericValue(projectBudget);
  const slaTargetMinutes = targetInMinutes(projectSla, projectSlaUnit);
  const pendingDays = daysUntil(goLiveDate);

  function updateStage(patch: Partial<CanvasStage>) {
    if (!selectedStage) return;
    setStages((current) => current.map((stage) => stage.id === selectedStage.id ? { ...stage, ...patch } : stage));
  }

  function changeType(key: StageKind) {
    const next = stageTypes.find((item) => item.key === key) ?? stageTypes[0];
    updateStage({ type: next.label, iconKey: next.key, color: next.color });
  }

  function addStage(kind: (typeof stageTypes)[number]) {
    const next: CanvasStage = {
      id: createId("stage"),
      name: `New ${kind.label.toLowerCase()}`,
      type: kind.label,
      platform: "Other",
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

  function addProperty(definition?: (typeof propertyPresets)[number]) {
    if (!selectedStage) return;
    const baseName = definition?.label ?? "New property";
    const existingNames = new Set(selectedStage.properties.map((property) => property.name.toLowerCase()));
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name.toLowerCase())) name = `${baseName} ${suffix++}`;
    const property = { id: createId("property"), name, value: "", kind: definition?.kind ?? "custom", unit: definition?.unit, currency: definition?.currency };
    updateStage({ properties: [...selectedStage.properties, property] });
    setShowPropertyMenu(false);
  }

  function updateProperty(id: string, patch: Partial<StageProperty>) {
    if (!selectedStage) return;
    const existing = selectedStage.properties.find((property) => property.id === id);
    if (!existing) return;
    if (patch.name?.trim() && selectedStage.properties.some((property) => property.id !== id && property.name.trim().toLowerCase() === patch.name?.trim().toLowerCase())) {
      setMessage("Property names must be unique within a stage");
      return;
    }
    const normalizedPatch = { ...patch };
    if (patch.value !== undefined && propertyKind(existing) === "cost") {
      normalizedPatch.value = patch.value === "" ? "" : String(Math.max(0, Math.trunc(Number(patch.value) || 0)));
    }
    updateStage({ properties: selectedStage.properties.map((property) => property.id === id ? { ...property, ...normalizedPatch } : property) });
  }

  function removeProperty(id: string) {
    if (!selectedStage) return;
    updateStage({ properties: selectedStage.properties.filter((property) => property.id !== id) });
  }

  function recordVersion(summary: string) {
    const draft = { name: processName.trim(), status: projectStatus, environment, goLiveDate, budget: projectBudget, budgetCurrency, sla: projectSla, slaUnit: projectSlaUnit, stages };
    const next = nextCanvasVersion(versions, draft, summary, versionTags);
    const updated = [next, ...versions];
    writeCanvasDraft(draft);
    writeCanvasVersions(updated);
    setVersions(updated);
    return { draft, next, updated };
  }

  function saveDraft() {
    recordVersion("Saved local canvas");
    setMessage("Draft saved locally");
  }

  function saveDeclaFile() {
    const { draft, updated } = recordVersion("Exported .decla file");
    const fileName = (draft.name || "untitled-decision-canvas").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled-decision-canvas";
    const payload = JSON.stringify({ format: "decla", formatVersion: 1, exportedAt: new Date().toISOString(), canvas: draft, versions: updated }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.decla`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    setMessage(".decla file downloaded");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".decla")) {
      setMessage("Please choose a .decla file");
      return;
    }
    try {
      const payload = JSON.parse(await file.text()) as { format?: string; canvas?: { name?: string; status?: CanvasStatus; environment?: CanvasEnvironment; goLiveDate?: string; budget?: string; budgetCurrency?: string; sla?: string; slaUnit?: string; stages?: CanvasStage[] }; versions?: CanvasVersion[] };
      const draft = payload.canvas;
      if (payload.format !== "decla" || !draft || !Array.isArray(draft.stages)) throw new Error("Invalid .decla file");
      const importedStatus = draft.status && statusOptions.some((option) => option.value === draft.status) ? draft.status : "draft";
      setProcessName(draft.name ?? "");
      setProjectStatus(importedStatus);
      setEnvironment(draft.environment ?? "development");
      setGoLiveDate(draft.goLiveDate ?? "");
      setProjectBudget(draft.budget ?? "");
      setBudgetCurrency(draft.budgetCurrency ?? "USD");
      setProjectSla(draft.sla ?? "");
      setProjectSlaUnit(draft.slaUnit ?? "days");
      setStages(draft.stages);
      setSelectedId(draft.stages[0]?.id ?? null);
      const importedVersions = Array.isArray(payload.versions) ? payload.versions.map((version) => ({ ...version, environment: version.environment ?? "development" as const, goLiveDate: version.goLiveDate ?? "", tags: Array.isArray(version.tags) ? version.tags : [] })) : [];
      setVersions(importedVersions);
      setVersionTags(importedVersions[0]?.tags ?? []);
      writeCanvasDraft({ name: draft.name ?? "", status: importedStatus, environment: draft.environment ?? "development", goLiveDate: draft.goLiveDate ?? "", budget: draft.budget ?? "", budgetCurrency: draft.budgetCurrency ?? "USD", sla: draft.sla ?? "", slaUnit: draft.slaUnit ?? "days", stages: draft.stages });
      writeCanvasVersions(importedVersions);
      setMessage(".decla file imported");
    } catch {
      setMessage("This .decla file could not be imported");
    }
  }

  function toggleVersionTag(tag: string) {
    setVersionTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  function exportFileName(extension: string) {
    const base = processName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled-decision-canvas";
    return `${base}.${extension}`;
  }

  function escapeXml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
  }

  function flowSvg() {
    const cardWidth = 180;
    const cardGap = 40;
    const leftPad = 40;
    const stagesWidth = stages.length * (cardWidth + cardGap);
    const width = Math.max(960, stagesWidth + leftPad * 2);
    const title = escapeXml(processName.trim() || "Untitled project");

    // Project property summary row
    const budgetLabel = projectBudget ? `${budgetCurrency} ${Number(projectBudget).toLocaleString()}` : "—";
    const slaLabel = projectSla ? `${projectSla} ${projectSlaUnit}` : "—";
    const envLabel = environment.charAt(0).toUpperCase() + environment.slice(1);
    const goLiveLabel = formatShortDate(goLiveDate);
    const propSummary = [
      `Budget: ${budgetLabel}`,
      `SLA: ${slaLabel}`,
      `Env: ${envLabel}`,
      `Go-live: ${goLiveLabel}`,
      `${stages.length} stage${stages.length !== 1 ? "s" : ""} · ${totalProperties} propert${totalProperties !== 1 ? "ies" : "y"}`,
    ].join("   ·   ");

    const headerH = 80;
    const propsH = 32;
    const canvasY = headerH + propsH + 16;
    const cardH = 164;
    const totalH = canvasY + cardH + 40;

    const cards = stages.map((stage, index) => {
      const x = leftPad + index * (cardWidth + cardGap);
      const cy = canvasY + 42;
      const icon = `${window.location.origin}/icons/stages/${stage.iconKey}.svg`;
      const nextX = x + cardWidth;
      const connector = index < stages.length - 1
        ? `<line x1="${nextX}" y1="${canvasY + cardH / 2}" x2="${nextX + cardGap}" y2="${canvasY + cardH / 2}" stroke="#c5ccd6" stroke-width="1.5"/><path d="M ${nextX + cardGap - 6} ${canvasY + cardH / 2 - 5} L ${nextX + cardGap} ${canvasY + cardH / 2} L ${nextX + cardGap - 6} ${canvasY + cardH / 2 + 5}" fill="none" stroke="#a9b2bc" stroke-width="1.5"/>`
        : "";
      return [
        connector,
        `<g>`,
        `<rect x="${x}" y="${canvasY}" width="${cardWidth}" height="${cardH}" rx="9" fill="#fff" stroke="${stage.color}" stroke-width="1.5"/>`,
        `<rect x="${x}" y="${canvasY}" width="${cardWidth}" height="3" rx="1.5" fill="${stage.color}"/>`,
        `<text x="${x + 12}" y="${canvasY + 20}" fill="#a0a9b4" font-size="9" font-family="Arial, sans-serif" font-weight="700">0${index + 1}</text>`,
        `<circle cx="${x + 30}" cy="${cy}" r="18" fill="${stage.color}" fill-opacity=".1"/>`,
        `<image href="${icon}" x="${x + 17}" y="${cy - 13}" width="24" height="24"/>`,
        `<text x="${x + 12}" y="${cy + 34}" fill="#1e2a3a" font-size="12" font-family="Arial, sans-serif" font-weight="700">${escapeXml(stage.name || "Untitled")}</text>`,
        `<text x="${x + 12}" y="${cy + 51}" fill="${stage.color}" font-size="9" font-family="Arial, sans-serif" font-weight="700">${escapeXml(stage.type)}</text>`,
        `<text x="${x + 12}" y="${cy + 66}" fill="#8a93a2" font-size="9" font-family="Arial, sans-serif">${escapeXml(stage.platform)}</text>`,
        stage.properties.length > 0 ? `<rect x="${x + 12}" y="${cy + 75}" width="${Math.min(cardWidth - 24, stage.properties.length * 10 + 32)}" height="13" rx="3" fill="#f2f3f6"/><text x="${x + 18}" y="${cy + 85}" fill="#7d8797" font-size="8" font-family="Arial, sans-serif" font-weight="700">${stage.properties.length} ${stage.properties.length === 1 ? "property" : "properties"}</text>` : "",
        `</g>`,
      ].join("");
    }).join("");

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">`,
      `<rect width="100%" height="100%" fill="#f8f9fb"/>`,
      // Project name
      `<text x="${leftPad}" y="38" fill="#1a2233" font-size="20" font-family="Arial, sans-serif" font-weight="700">${title}</text>`,
      // Properties summary bar
      `<rect x="${leftPad}" y="${headerH}" width="${width - leftPad * 2}" height="${propsH}" rx="6" fill="#fff" stroke="#e1e4e9"/>`,
      `<text x="${leftPad + 14}" y="${headerH + 21}" fill="#6b7585" font-size="9.5" font-family="Arial, sans-serif">${escapeXml(propSummary)}</text>`,
      // Stages
      stages.length > 0 ? cards : `<text x="${leftPad}" y="${canvasY + 40}" fill="#a0a9b4" font-size="13" font-family="Arial, sans-serif">No stages added yet.</text>`,
      `</svg>`,
    ].join("");
  }

  function exportSvg() {
    const blob = new Blob([flowSvg()], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName("svg");
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    setMessage("SVG exported");
  }

  function exportPng() {
    const svgBlob = new Blob([flowSvg()], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width * 2;
      canvas.height = image.height * 2;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(2, 2);
      context.fillStyle = "#fbfcfd";
      context.fillRect(0, 0, image.width, image.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = exportFileName("png");
        link.click();
        URL.revokeObjectURL(pngUrl);
        setMessage("PNG exported");
      }, "image/png");
      URL.revokeObjectURL(svgUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setMessage("PNG export could not be created");
    };
    image.src = svgUrl;
    setShowExportMenu(false);
  }

  function loadExample() {
    setStages(seedStages);
    setSelectedId(seedStages[2].id);
    setMessage("Example process loaded");
  }

  function clearCanvas() {
    const hasWorkspaceContent = Boolean(processName || projectStatus !== "draft" || environment !== "development" || goLiveDate || projectBudget || projectSla || versionTags.length || stages.length || versions.length);
    if (!hasWorkspaceContent || window.confirm("Clear this entire decision workspace, including saved versions?")) {
      setStages([]);
      setSelectedId(null);
      setProcessName("");
      setProjectStatus("draft");
      setEnvironment("development");
      setGoLiveDate("");
      setProjectBudget("");
      setBudgetCurrency("USD");
      setProjectSla("");
      setProjectSlaUnit("days");
      setVersionTags([]);
      setVersions([]);
      writeCanvasVersions([]);
      window.localStorage.removeItem(CANVAS_STORAGE_KEY);
      setShowAddMenu(false);
      setMessage("Workspace cleared");
    }
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (activeTool !== "pan" || event.button !== 0 || !viewportRef.current) return;
    const viewport = viewportRef.current;
    panStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
    setIsPanning(true);
    event.preventDefault();
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const start = panStartRef.current;
    const viewport = viewportRef.current;
    if (!start || !viewport || start.pointerId !== event.pointerId) return;
    viewport.scrollLeft = start.scrollLeft - (event.clientX - start.x);
    viewport.scrollTop = start.scrollTop - (event.clientY - start.y);
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panStartRef.current?.pointerId !== event.pointerId) return;
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) viewportRef.current.releasePointerCapture(event.pointerId);
    panStartRef.current = null;
    setIsPanning(false);
  }

  return (
    <AppShell status="ready" action={<button className="toolbar-save" onClick={saveDeclaFile}>Save to File <span>⌘ S</span></button>}>
      <div className="process-page">
        <header className="process-heading">
          <div>
            <div className="eyebrow-row"><span className="process-eyebrow">DECISION CANVAS</span>{versions[0] && <span className="version-mini">v{versions[0].version}</span>}</div>
            <div className="process-title-row"><input className="process-title-input" value={processName} onChange={(event) => setProcessName(event.target.value)} placeholder="Untitled decision canvas" aria-label="Decision canvas name" /></div>
            <div className="version-tag-bar"><span>VERSION TAGS <em>Optional</em></span><div>{versionTagOptions.map((tag) => <button key={tag} className={versionTags.includes(tag) ? "selected" : ""} onClick={() => toggleVersionTag(tag)}>{tag}</button>)}</div></div>
          </div>
          <div className="process-heading-actions">
            <div className="header-status-group"><span className="local-pill"><i /> Local draft</span><label className={`project-status-control header-project-status ${projectStatus}`}><span>PROJECT STATUS</span><SearchableSelect value={projectStatus} options={statusOptions} onChange={(value) => setProjectStatus(value as CanvasStatus)} ariaLabel="Project status" /></label></div><button className="secondary-button" onClick={() => setMessage("Share link copied to clipboard")}>Share</button>
            <input ref={importInputRef} className="hidden-file-input" type="file" accept=".decla" onChange={handleImport} /><button className="secondary-button" onClick={() => importInputRef.current?.click()}>Import file</button><button className="secondary-button" onClick={saveDraft}>Save version</button><button className="primary-button" onClick={saveDeclaFile}>Save to File</button><div className="export-menu-wrap"><button className="secondary-button" onClick={() => setShowExportMenu((open) => !open)}>Export <span className="button-caret">⌄</span></button>{showExportMenu && <div className="floating-menu export-menu"><small>EXPORT CANVAS</small><button onClick={exportSvg}>SVG image <span>.svg</span></button><button onClick={exportPng}>PNG image <span>.png</span></button></div>}</div><button className="clear-canvas-button" onClick={clearCanvas} disabled={!Boolean(processName || projectStatus !== "draft" || environment !== "development" || goLiveDate || projectBudget || projectSla || versionTags.length || stages.length || versions.length)}>Clear workspace</button>
          </div>
        </header>

        <section className="project-properties-strip" aria-label="Project properties">
          <div className="project-properties-title"><span>PROJECT</span><strong>PROPERTIES</strong></div>
          <div className="project-property-metric editable-metric">
            <span>PROJECT BUDGET / RUN</span>
            <div className="prop-control-group">
              <input type="number" min="0" step="1" value={projectBudget} onChange={(event) => setProjectBudget(event.target.value)} placeholder="No budget" aria-label="Project budget" className="prop-input-number" />
              <SearchableSelect value={budgetCurrency} options={currencies.map((currency) => ({ value: currency, label: currency }))} onChange={setBudgetCurrency} ariaLabel="Budget currency" className="prop-select-currency" />
            </div>
            <small>Run: <em>{budgetCurrency}</em> {totalCost.toLocaleString()}{budgetTotal > 0 ? ` · ${Math.round((totalCost / budgetTotal) * 100)}% of cap` : " · Set budget cap"}</small>
          </div>
          <div className="project-property-metric editable-metric">
            <span>PROJECT SLA TARGET</span>
            <div className="prop-control-group">
              <input type="number" min="0" step="1" value={projectSla} onChange={(event) => setProjectSla(event.target.value)} placeholder="No SLA" aria-label="Project SLA" className="prop-input-number" />
              <SearchableSelect value={projectSlaUnit} options={durationUnits.map((unit) => ({ value: unit, label: unit }))} onChange={setProjectSlaUnit} ariaLabel="Project SLA unit" className="prop-select-unit" />
            </div>
            <small>Run: {formatDuration(totalLatencyMinutes)}{slaTargetMinutes > 0 ? ` · ${Math.round((totalLatencyMinutes / slaTargetMinutes) * 100)}% ceiling` : " · end-to-end ceiling"}</small>
          </div>
          <div className="project-property-metric editable-metric">
            <span>ENVIRONMENT</span>
            <div className="prop-control-group">
              <SearchableSelect value={environment} options={environmentOptions} onChange={(value) => setEnvironment(value as CanvasEnvironment)} ariaLabel="Project environment" className={`prop-select-env ${environment}`} />
            </div>
            <small>{environment === "production" ? "Live traffic" : environment === "staging" ? "Pre-production" : "Sandbox environment"}</small>
          </div>
          <div className="project-property-metric editable-metric">
            <span>GO-LIVE TARGET</span>
            <div className="prop-control-group">
              <input type="date" value={goLiveDate} onChange={(event) => setGoLiveDate(event.target.value)} aria-label="Go-live target date" className="prop-input-date" />
            </div>
            <small>{goLiveDate ? formatShortDate(goLiveDate) : "Choose a target date"}</small>
          </div>
          <div className="project-property-metric days-pending">
            <span>DAYS PENDING</span>
            <strong>{pendingDays === null ? "—" : pendingDays > 0 ? pendingDays : 0}</strong>
            <small>{pendingDays === null ? "No target date" : pendingDays > 0 ? "calendar days remaining" : pendingDays === 0 ? "go live is today" : `${Math.abs(pendingDays)} days past target`}</small>
          </div>
          <div className="project-property-metric">
            <span>SCOPE</span>
            <strong>{stages.length}<span className="prop-cap"> stages</span></strong>
            <small>{totalProperties} total properties</small>
          </div>
        </section>

        {message && <button className="process-toast" onClick={() => setMessage("")} aria-label="Dismiss message">{message}<span>×</span></button>}

        <div className="process-layout">
          <section className="process-canvas-panel">
            <div className="canvas-toolbar">
              <div className="canvas-toolbar-group">
                <button className={`tool-button ${activeTool === "select" ? "active" : ""}`} onClick={() => setActiveTool("select")} aria-label="Select tool" aria-pressed={activeTool === "select"}>↖ <span>Select</span></button>
                <button className={`tool-button ${activeTool === "pan" ? "active" : ""}`} onClick={() => setActiveTool("pan")} aria-label="Pan tool" aria-pressed={activeTool === "pan"}>✋ <span>Pan</span></button>
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
                <button className="fit-button" onClick={() => { setZoom(100); viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); }}>Fit</button>
              </div>
            </div>

            <div ref={viewportRef} className={`canvas-viewport ${activeTool === "pan" ? "pan-mode" : ""} ${isPanning ? "is-panning" : ""}`} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
              <div className="canvas-surface" style={{ "--canvas-zoom": zoom / 100 } as CSSProperties}>
                {stages.length === 0 ? <div className="blank-canvas-state"><span className="blank-canvas-mark">＋</span><span className="process-eyebrow">BLANK PROCESS CANVAS</span><h2>Start mapping your process</h2><p>Add a stage to begin, or explore the example business flow.</p><div><button className="primary-button" onClick={() => setShowAddMenu(true)}>＋ Add first stage</button><button className="secondary-button" onClick={loadExample}>Load example</button></div></div> : <>
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
                </>}
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
                <label><span>Type</span><SearchableSelect value={selectedStage.iconKey} options={stageTypes.map((type) => ({ value: type.key, label: type.label }))} onChange={(value) => changeType(value as StageKind)} ariaLabel="Stage type" /></label>
                <label><span>Platform</span><SearchableSelect value={selectedStage.platform} options={platforms.map((platform) => ({ value: platform, label: platform }))} onChange={(value) => updateStage({ platform: value })} ariaLabel="Stage platform" /></label>
              </div>

              <div className="properties-section"><div className="properties-heading"><div><span className="process-eyebrow">CUSTOM DATA</span><strong>Properties</strong></div><div className="property-add-wrap"><button className="add-property-button" onClick={() => setShowPropertyMenu((open) => !open)}>＋ Add property</button>{showPropertyMenu && <div className="floating-menu property-menu"><small>CHOOSE A PROPERTY</small>{propertyPresets.filter((preset) => !selectedStage.properties.some((property) => propertyKind(property) === preset.kind)).map((preset) => <button key={preset.kind} onClick={() => addProperty(preset)}>{preset.label}<span>+</span></button>)}<button onClick={() => addProperty()}><em>＋</em> Custom property</button></div>}</div></div>
                <p className="properties-help">Add the metrics your team uses to describe this stage.</p>
                <div className="property-list">
                  {selectedStage.properties.map((property) => { const kind = propertyKind(property); const numericKind = kind === "cost" || kind === "duration" || kind === "sla" || kind === "rows"; return <div className={`property-row property-${kind}`} key={property.id}><input value={property.name} onChange={(event) => updateProperty(property.id, { name: event.target.value })} aria-label="Property name" /><span>:</span><input className="property-value-input" type={numericKind ? "number" : "text"} min={numericKind ? "0" : undefined} step={kind === "cost" ? "1" : undefined} inputMode={numericKind ? "numeric" : undefined} value={property.value} onChange={(event) => updateProperty(property.id, { value: event.target.value })} placeholder={numericKind ? "0" : "Add value"} aria-label={`${property.name} value`} />{kind === "cost" && <SearchableSelect className="property-meta-select" value={property.currency ?? "USD"} options={currencies.map((currency) => ({ value: currency, label: currency }))} onChange={(value) => updateProperty(property.id, { currency: value })} ariaLabel={`${property.name} currency`} />}{(kind === "duration" || kind === "sla") && <SearchableSelect className="property-meta-select" value={property.unit ?? (kind === "sla" ? "days" : "hours")} options={durationUnits.map((unit) => ({ value: unit, label: unit }))} onChange={(value) => updateProperty(property.id, { unit: value })} ariaLabel={`${property.name} unit`} />}<button onClick={() => removeProperty(property.id)} aria-label={`Remove ${property.name} property`}>×</button></div>; })}
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

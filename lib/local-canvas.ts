export type PropertyKind = "duration" | "cost" | "rows" | "owner" | "sla" | "custom";
export type StageProperty = { id: string; name: string; value: string; kind?: PropertyKind; unit?: string; currency?: string };

export type CanvasStageIconKey =
  | "source"
  | "transform"
  | "database"
  | "human-action"
  | "business-rule"
  | "llm"
  | "user-interface"
  | "decision"
  | "terminal"
  | "analytics";

export type CanvasStage = {
  id: string;
  name: string;
  type: string;
  platform: string;
  iconKey: CanvasStageIconKey;
  color: string;
  properties: StageProperty[];
  /** Canvas x position (set by React Flow / auto-layout) */
  x?: number;
  /** Canvas y position (set by React Flow / auto-layout) */
  y?: number;
};

/**
 * A directed connection between two stages.
 * Phase 1: labeled edges between any two stages.
 * Phase 2: multiple outgoing edges from Decision nodes (branching).
 */
export type CanvasEdge = {
  id: string;
  fromStageId: string;
  toStageId: string;
  /** Human-readable label shown on the edge, e.g. "Yes", "No", "Damaged product" */
  label?: string;
  /** Edge stroke color — overrides default when set */
  color?: string;
  /** Optional machine-readable condition expression */
  condition?: string;
};

export type CanvasDraft = {
  name: string;
  status: CanvasStatus;
  environment: CanvasEnvironment;
  goLiveDate: string;
  budget: string;
  budgetCurrency: string;
  sla: string;
  slaUnit: string;
  stages: CanvasStage[];
  /** Directed edges between stages. Empty for legacy canvases — defaults to linear chain. */
  edges: CanvasEdge[];
};

export type CanvasStatus = "draft" | "under-review" | "approved" | "archived";
export type CanvasEnvironment = "development" | "staging" | "production";

export type CanvasVersion = CanvasDraft & {
  id: string;
  version: number;
  createdAt: string;
  summary: string;
  tags: string[];
};

/** Bumped to v4 because edges[] is a structural change to the draft format. */
export const CANVAS_STORAGE_KEY = "decla-process-canvas-v4";
export const VERSIONS_STORAGE_KEY = "decla-process-versions-v2";

export function normalizeCanvasStages(stages: CanvasStage[]) {
  return stages.map((stage) =>
    stage.iconKey === "analytics" && stage.type?.toLowerCase() === "decision"
      ? { ...stage, iconKey: "decision" as const }
      : stage,
  );
}

/**
 * Migrate a legacy canvas that has no edges by building a linear chain
 * connecting each stage to the next in order.
 */
export function normalizeCanvasEdges(stages: CanvasStage[], edges?: CanvasEdge[]): CanvasEdge[] {
  if (Array.isArray(edges) && edges.length > 0) return edges;
  // Legacy: synthesise a linear chain so the graph is still connected.
  return stages.slice(0, -1).map((stage, index) => ({
    id: `edge-legacy-${index}`,
    fromStageId: stage.id,
    toStageId: stages[index + 1].id,
  }));
}

export function readCanvasVersions() {
  if (typeof window === "undefined") return [] as CanvasVersion[];
  try {
    const raw = window.localStorage.getItem(VERSIONS_STORAGE_KEY);
    const versions = raw ? JSON.parse(raw) as CanvasVersion[] : [];
    return versions.map((version) => ({
      ...version,
      environment: version.environment ?? "development",
      goLiveDate: version.goLiveDate ?? "",
      tags: Array.isArray(version.tags) ? version.tags : [],
      stages: normalizeCanvasStages(version.stages ?? []),
      edges: normalizeCanvasEdges(version.stages ?? [], version.edges),
    }));
  } catch {
    return [] as CanvasVersion[];
  }
}

export function writeCanvasDraft(draft: CanvasDraft) {
  window.localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(draft));
}

export function writeCanvasVersions(versions: CanvasVersion[]) {
  window.localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(versions));
}

export function nextCanvasVersion(versions: CanvasVersion[], draft: CanvasDraft, summary = "Saved local canvas", tags: string[] = []) {
  return {
    id: `local-version-${Date.now()}`,
    version: (versions[0]?.version ?? 0) + 1,
    createdAt: new Date().toISOString(),
    summary,
    tags,
    ...draft,
  } satisfies CanvasVersion;
}

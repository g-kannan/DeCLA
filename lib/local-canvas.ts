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

export const CANVAS_STORAGE_KEY = "decla-process-canvas-v3";
export const VERSIONS_STORAGE_KEY = "decla-process-versions-v1";

export function normalizeCanvasStages(stages: CanvasStage[]) {
  return stages.map((stage) =>
    stage.iconKey === "analytics" && stage.type?.toLowerCase() === "decision"
      ? { ...stage, iconKey: "decision" as const }
      : stage,
  );
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

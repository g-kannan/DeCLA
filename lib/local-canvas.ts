export type PropertyKind = "duration" | "cost" | "rows" | "owner" | "sla" | "custom";
export type StageProperty = { id: string; name: string; value: string; kind?: PropertyKind; unit?: string; currency?: string };

export type CanvasStage = {
  id: string;
  name: string;
  type: string;
  platform: string;
  iconKey: "source" | "transform" | "database" | "analytics" | "terminal";
  color: string;
  properties: StageProperty[];
};

export type CanvasDraft = {
  name: string;
  status: CanvasStatus;
  stages: CanvasStage[];
};

export type CanvasStatus = "draft" | "under-review" | "approved" | "archived";

export type CanvasVersion = CanvasDraft & {
  id: string;
  version: number;
  createdAt: string;
  summary: string;
  tags: string[];
};

export const CANVAS_STORAGE_KEY = "decla-process-canvas-v3";
export const VERSIONS_STORAGE_KEY = "decla-process-versions-v1";

export function readCanvasVersions() {
  if (typeof window === "undefined") return [] as CanvasVersion[];
  try {
    const raw = window.localStorage.getItem(VERSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as CanvasVersion[] : [];
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

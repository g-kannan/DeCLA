export type JsonSchemaProperty = {
  type?: "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  enum?: Array<string | number>;
};

export type StageType = {
  id: string;
  key: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  enabled: boolean;
  version: {
    id: string;
    version_number: number;
    schema: {
      type?: string;
      properties?: Record<string, JsonSchemaProperty>;
      required?: string[];
    };
  };
};

export type Stage = {
  id: string;
  logical_key: string;
  stage_type_version_id: string;
  position: number;
  label: string;
  platform: string;
  properties: Record<string, unknown>;
  note: string;
  stage_type_key: string;
  stage_type_name: string;
  category: string;
  icon: string;
  color: string;
};

export type Measure = {
  id: string;
  measure_definition_id: string;
  measure_key: string;
  measure_name: string;
  unit: string;
  value_type: string;
  improvement_direction: string;
  stage_id: string | null;
  numeric_value: string | number | null;
  text_value: string | null;
  source: string;
  explanation: string;
};

export type Version = {
  id: string;
  dataflow_id: string;
  version_number: number;
  version_name: string;
  change_summary: string;
  business_goal: string;
  latency_target_minutes: string | number | null;
  monthly_budget: string | number | null;
  status: "draft" | "published" | "archived";
  created_from_version_id: string | null;
  created_at: string;
  published_at: string | null;
  tags: string[];
  stages: Stage[];
  measures: Measure[];
};

export type DataflowSummary = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  current_version_id: string | null;
  current_version_number: number | null;
  proposed_version_id: string | null;
  proposed_version_number: number | null;
};

export type DataflowCreate = {
  name: string;
  description: string;
  business_goal: string;
  latency_target_minutes: number | null;
  monthly_budget: number | null;
};

export type ComparisonMeasure = {
  definition_id: string;
  key: string;
  name: string;
  unit: string;
  value_type: string;
  direction: string;
  current_value: string | number | null;
  proposed_value: string | number | null;
  absolute_change: string | number | null;
  percentage_improvement: string | number | null;
  assessment: "better" | "worse" | "unchanged" | "not_comparable";
  current_text: string | null;
  proposed_text: string | null;
};

export type Comparison = {
  dataflow_id: string;
  current: Version;
  proposed: Version;
  measures: ComparisonMeasure[];
  stage_differences: Array<{
    logical_key: string;
    current_stage: Stage | null;
    proposed_stage: Stage | null;
    change: "added" | "removed" | "modified" | "unchanged";
  }>;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listDataflows: () => request<DataflowSummary[]>("/api/dataflows"),
  createDataflow: (payload: DataflowCreate) =>
    request<Version>("/api/dataflows", { method: "POST", body: JSON.stringify(payload) }),
  listStageTypes: () => request<StageType[]>("/api/definitions/stage-types"),
  getVersion: (dataflowId: string, tag: "current" | "proposed") =>
    request<Version>(`/api/dataflows/${dataflowId}/versions?tag=${tag}`),
  listVersions: (dataflowId: string) =>
    request<Version[]>(`/api/dataflows/${dataflowId}/version-history`),
  getComparison: (dataflowId: string) =>
    request<Comparison>(`/api/dataflows/${dataflowId}/comparison`),
  updateVersion: (dataflowId: string, version: Version) =>
    request<Version>(`/api/dataflows/${dataflowId}/versions/${version.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        version_name: version.version_name,
        change_summary: version.change_summary,
        business_goal: version.business_goal,
        latency_target_minutes: version.latency_target_minutes,
        monthly_budget: version.monthly_budget,
        stages: version.stages.map((stage, position) => ({
          id: stage.id,
          logical_key: stage.logical_key,
          stage_type_version_id: stage.stage_type_version_id,
          position,
          label: stage.label,
          platform: stage.platform,
          properties: stage.properties,
          note: stage.note,
        })),
        measures: version.measures
          .filter((measure) => !measure.stage_id)
          .map((measure) => ({
            measure_definition_id: measure.measure_definition_id,
            numeric_value: measure.numeric_value,
            text_value: measure.text_value,
            source: measure.source,
            explanation: measure.explanation,
          })),
      }),
    }),
  cloneProposed: (dataflowId: string) =>
    request<Version>(`/api/dataflows/${dataflowId}/versions`, {
      method: "POST",
      body: JSON.stringify({ from_tag: "current", assign_tag: "proposed" }),
    }),
  publish: (dataflowId: string, versionId: string) =>
    request<Version>(`/api/dataflows/${dataflowId}/versions/${versionId}/publish`, {
      method: "POST",
    }),
  promote: (dataflowId: string) =>
    request<Version>(`/api/dataflows/${dataflowId}/promote`, { method: "POST" }),
};

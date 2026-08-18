import type { CanvasStageIconKey, PropertyKind, StageProperty } from "@/lib/local-canvas";

export type StageKind = Exclude<CanvasStageIconKey, "analytics">;

export type PropertyPreset = {
  label: string;
  kind: PropertyKind;
  unit?: string;
  currency?: string;
  defaultValue?: string;
};

export const universalPropertyPresets: PropertyPreset[] = [
  { label: "Duration", kind: "duration", unit: "hours" },
  { label: "Cost", kind: "cost", currency: "USD" },
  { label: "Rows", kind: "rows", unit: "rows" },
  { label: "Owner", kind: "owner" },
  { label: "SLA", kind: "sla", unit: "days" },
];

const llmAgentPropertyPresets: PropertyPreset[] = [
  { label: "Model", kind: "model" },
  { label: "Temperature", kind: "temperature", defaultValue: "0.2" },
  { label: "Max tokens", kind: "max-tokens" },
  { label: "System prompt", kind: "system-prompt" },
  { label: "Task", kind: "llm-task" },
  { label: "Grounding", kind: "grounding" },
  { label: "Guardrail", kind: "guardrail" },
];

export const stagePropertyPresets: Record<StageKind, PropertyPreset[]> = {
  source: [
    { label: "Data source", kind: "data-source" },
    { label: "Format", kind: "format" },
    { label: "Frequency", kind: "frequency" },
    { label: "Trigger", kind: "trigger" },
    { label: "Volume", kind: "rows", unit: "rows" },
    { label: "Owner", kind: "owner" },
  ],
  transform: [
    { label: "Operation", kind: "operation" },
    { label: "Error handling", kind: "error-handling" },
    { label: "Duration", kind: "duration", unit: "hours" },
  ],
  database: [
    { label: "Storage engine", kind: "storage-engine" },
    { label: "Access mode", kind: "access-mode" },
    { label: "Retention", kind: "retention" },
    { label: "Governance", kind: "governance" },
  ],
  "human-action": [
    { label: "Owner", kind: "owner" },
    { label: "SLA", kind: "sla", unit: "hours" },
    { label: "Input mode", kind: "input-mode" },
    { label: "Action type", kind: "action-type" },
    { label: "Escalation", kind: "escalation" },
  ],
  "business-rule": [
    { label: "Rule type", kind: "rule-type" },
    { label: "Enforcement", kind: "enforcement" },
    { label: "Outcomes", kind: "outcomes" },
    { label: "Audit record", kind: "audit-required" },
  ],
  llm: llmAgentPropertyPresets,
  "user-interface": [
    { label: "Channel", kind: "channel" },
    { label: "Audience", kind: "audience" },
    { label: "Delivery", kind: "delivery" },
  ],
  decision: [
    { label: "Question", kind: "question" },
    { label: "Outcomes", kind: "outcomes" },
    { label: "Evaluation", kind: "evaluation" },
    { label: "Default path", kind: "default-path" },
  ],
  terminal: [
    { label: "Execution engine", kind: "execution-engine" },
    { label: "Trigger", kind: "trigger" },
    { label: "Retry policy", kind: "retry-policy" },
    { label: "Timeout", kind: "timeout", unit: "mins" },
    { label: "Duration", kind: "duration", unit: "hours" },
  ],
  "feedback-loop": [
    { label: "Loop type", kind: "loop-type" },
    { label: "Max iterations", kind: "max-iterations" },
    { label: "Exit condition", kind: "exit-condition" },
  ],
  alert: [
    { label: "Severity", kind: "severity" },
    { label: "Channel", kind: "channel" },
    { label: "Recipients", kind: "recipients" },
    { label: "Throttle", kind: "throttle" },
  ],
  agent: [
    ...llmAgentPropertyPresets,
    { label: "Tools", kind: "tools" },
    { label: "Orchestration", kind: "orchestration" },
    { label: "Memory", kind: "memory" },
    { label: "Autonomy", kind: "autonomy" },
  ],
  "integration-tool": [
    { label: "Integration type", kind: "integration-type" },
    { label: "Auth method", kind: "auth-method" },
    { label: "Direction", kind: "direction" },
    { label: "Rate limit", kind: "rate-limit", unit: "req/min" },
    { label: "Idempotency", kind: "idempotency" },
  ],
};

export const stageConfigNotes: Partial<Record<StageKind, { title: string; description: string }>> = {
  source: { title: "Input configuration", description: "Data source, format, trigger, and ingestion frequency are stored as stage properties." },
  transform: { title: "Transform configuration", description: "Operation type and error handling are stored as stage properties." },
  database: { title: "Storage configuration", description: "Engine, access mode, retention, and governance are stored as stage properties." },
  "human-action": { title: "Human action configuration", description: "Owner, SLA, input mode, and escalation are stored as stage properties." },
  "business-rule": { title: "Business rule configuration", description: "Rule type, enforcement, and outcomes are stored as stage properties." },
  llm: { title: "LLM configuration", description: "Model, temperature, token limits, and prompts are stored as stage properties." },
  "user-interface": { title: "UI configuration", description: "Channel, audience, and delivery mode are stored as stage properties." },
  decision: { title: "Decision configuration", description: "Question, outcomes, and evaluation logic are stored as stage properties." },
  terminal: { title: "Automation configuration", description: "Execution engine, trigger, and retry policy are stored as stage properties." },
  "feedback-loop": { title: "Feedback loop configuration", description: "Loop type, iteration limits, and exit conditions are stored as stage properties." },
  alert: { title: "Alert configuration", description: "Severity, channel, and recipients are stored as stage properties." },
  agent: { title: "AI Agent configuration", description: "Model, tools, orchestration, and autonomy are stored as stage properties." },
  "integration-tool": { title: "Integration configuration", description: "Integration type, auth, and rate limits are stored as stage properties." },
};

export const modelOptions = [
  "gpt-4o",
  "gpt-4o-mini",
  "claude-sonnet-4",
  "claude-haiku",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
];

export const propertyValueOptions: Partial<Record<PropertyKind, string[]>> = {
  model: modelOptions,
  temperature: ["0", "0.2", "0.5", "0.7", "1.0"],
  "max-tokens": ["512", "1024", "4096", "8192", "32768"],
  "data-source": ["API", "File upload", "Event stream (Kafka)", "Database CDC", "Webhook", "SaaS connector"],
  format: ["CSV", "JSON", "Parquet", "Avro", "XML", "Excel"],
  frequency: ["Real-time", "Hourly", "Daily", "Weekly", "On-demand"],
  operation: ["Filter", "Map", "Aggregate", "Join", "Mask/Anonymize", "Validate", "Enrich", "Deduplicate"],
  "error-handling": ["Fail fast", "Skip bad rows", "Dead letter queue", "Retry 3×", "Exponential backoff"],
  "storage-engine": ["Delta Lake", "Snowflake", "PostgreSQL", "MongoDB", "S3/Iceberg", "Redis", "Unity Catalog table"],
  "access-mode": ["Read", "Write", "Read-write"],
  retention: ["30 days", "90 days", "1 year", "7 years", "Indefinite"],
  governance: ["RLS", "Column masking", "Encryption at rest", "Lineage", "Audit log"],
  "input-mode": ["Web form", "Email", "Slack/Teams", "Ticket queue", "Review panel"],
  "action-type": ["Review", "Approve/Reject", "Data entry", "Exception handling", "Escalation"],
  escalation: ["None", "4 hours", "24 hours", "Manager chain", "On-call"],
  "rule-type": ["Validation gate", "Compliance check", "Threshold", "Policy enforcement", "Routing rule"],
  enforcement: ["Block", "Warn", "Route to review", "Log only"],
  outcomes: ["Pass | Fail", "Pass | Hold", "Multi-branch"],
  evaluation: ["Rule-based", "Score threshold", "ML classifier", "LLM judgment", "Human override"],
  "default-path": ["First match", "Else branch", "Escalate", "No default"],
  "llm-task": ["Classification", "Summarization", "SQL generation", "Extraction", "RAG Q&A", "Narrative synthesis"],
  grounding: ["None", "Retrieved docs", "SQL results", "Knowledge graph", "Tool output"],
  guardrail: ["PII mask required", "Hallucination check", "Confidence threshold", "Human review on low score"],
  channel: ["Web app", "Mobile", "Email", "Slack bot", "Streamlit", "Gradio", "API portal", "PagerDuty", "SMS", "Teams", "Webhook"],
  audience: ["Customer", "Internal ops", "Executive", "Analyst", "Partner"],
  delivery: ["Self-service", "Push notification", "Scheduled report", "Real-time dashboard"],
  "execution-engine": ["Databricks job", "Airflow DAG", "Lambda", "Cron", "GitHub Actions", "Spark notebook"],
  trigger: ["Scheduled", "Event-driven", "Upstream completion", "Manual", "Webhook"],
  "retry-policy": ["None", "3 retries", "Exponential backoff", "Dead letter"],
  "loop-type": ["Retry with context", "Human correction", "Quality score", "Model fine-tune signal"],
  "max-iterations": ["1", "3", "5", "10", "Unlimited"],
  "exit-condition": ["Success threshold met", "Max retries reached", "Manual break", "Timeout"],
  severity: ["Info", "Warning", "Critical", "P1 incident"],
  recipients: ["Owner team", "On-call", "Stakeholders", "Custom list"],
  throttle: ["No throttle", "1/hour", "1/day", "Per incident"],
  tools: ["Web search", "Code interpreter", "DB query", "API call", "RAG retrieval", "Human-in-the-loop"],
  orchestration: ["ReAct", "Plan-and-execute", "LangGraph", "CrewAI", "Custom"],
  memory: ["None", "Conversation window", "Vector store", "Long-term store"],
  autonomy: ["Suggest only", "Act with approval", "Fully autonomous"],
  "integration-type": ["REST API", "SOAP", "Webhook", "SDK", "SFTP", "Message queue (SQS/Kafka)"],
  "auth-method": ["API key", "OAuth 2.0", "mTLS", "Service account", "IAM role", "None"],
  direction: ["Inbound", "Outbound", "Bidirectional"],
  idempotency: ["Yes", "No", "N/A"],
  "audit-required": ["Required", "Optional", "Not applicable"],
};

const kindLabelMap: Partial<Record<PropertyKind, string>> = Object.fromEntries(
  Object.values(stagePropertyPresets).flat().map((preset) => [preset.kind, preset.label]),
) as Partial<Record<PropertyKind, string>>;

universalPropertyPresets.forEach((preset) => {
  kindLabelMap[preset.kind] = preset.label;
});

const nameKindHints: [string, PropertyKind][] = [
  ["duration", "duration"],
  ["cost", "cost"],
  ["row", "rows"],
  ["volume", "rows"],
  ["owner", "owner"],
  ["sla", "sla"],
  ["model", "model"],
  ["temperature", "temperature"],
  ["max token", "max-tokens"],
  ["tool", "tools"],
  ["system prompt", "system-prompt"],
  ["data source", "data-source"],
  ["format", "format"],
  ["frequency", "frequency"],
  ["operation", "operation"],
  ["error handling", "error-handling"],
  ["storage engine", "storage-engine"],
  ["access mode", "access-mode"],
  ["retention", "retention"],
  ["governance", "governance"],
  ["input mode", "input-mode"],
  ["action type", "action-type"],
  ["escalation", "escalation"],
  ["rule type", "rule-type"],
  ["enforcement", "enforcement"],
  ["outcome", "outcomes"],
  ["question", "question"],
  ["evaluation", "evaluation"],
  ["default path", "default-path"],
  ["task", "llm-task"],
  ["grounding", "grounding"],
  ["guardrail", "guardrail"],
  ["channel", "channel"],
  ["audience", "audience"],
  ["delivery", "delivery"],
  ["execution engine", "execution-engine"],
  ["trigger", "trigger"],
  ["retry", "retry-policy"],
  ["timeout", "timeout"],
  ["loop type", "loop-type"],
  ["max iteration", "max-iterations"],
  ["exit condition", "exit-condition"],
  ["severity", "severity"],
  ["recipient", "recipients"],
  ["throttle", "throttle"],
  ["orchestration", "orchestration"],
  ["memory", "memory"],
  ["autonomy", "autonomy"],
  ["integration type", "integration-type"],
  ["auth method", "auth-method"],
  ["direction", "direction"],
  ["rate limit", "rate-limit"],
  ["idempotency", "idempotency"],
  ["audit record", "audit-required"],
  ["audit required", "audit-required"],
];

export function propertyKind(property: StageProperty): PropertyKind {
  if (property.kind) return property.kind;
  const name = property.name.toLowerCase();
  for (const [hint, kind] of nameKindHints) {
    if (name.includes(hint)) return kind;
  }
  return "custom";
}

export function isNumericPropertyKind(kind: PropertyKind) {
  return kind === "cost" || kind === "duration" || kind === "sla" || kind === "rows" || kind === "rate-limit" || kind === "timeout";
}

export function isMultilinePropertyKind(kind: PropertyKind) {
  return kind === "system-prompt";
}

export function propertyKindHasOptions(kind: PropertyKind) {
  return Boolean(propertyValueOptions[kind]?.length);
}

export function propertyKindAllowsCustom(kind: PropertyKind) {
  if (kind === "custom" || kind === "question" || kind === "outcomes" || kind === "system-prompt" || kind === "trigger") return true;
  return propertyKindHasOptions(kind);
}

export function defaultStageProperties(iconKey: StageKind, createId: (prefix: string) => string): StageProperty[] {
  const defaults: Partial<Record<StageKind, PropertyPreset[]>> = {
    source: [
      { label: "Data source", kind: "data-source" },
      { label: "Format", kind: "format" },
      { label: "Trigger", kind: "trigger" },
    ],
    transform: [{ label: "Operation", kind: "operation" }],
    database: [{ label: "Storage engine", kind: "storage-engine" }],
    "human-action": [
      { label: "Owner", kind: "owner" },
      { label: "SLA", kind: "sla", unit: "hours" },
    ],
    "business-rule": [
      { label: "Rule type", kind: "rule-type" },
      { label: "Outcomes", kind: "outcomes" },
    ],
    llm: [
      { label: "Model", kind: "model" },
      { label: "Temperature", kind: "temperature", defaultValue: "0.2" },
    ],
    "user-interface": [{ label: "Channel", kind: "channel" }],
    decision: [
      { label: "Question", kind: "question" },
      { label: "Outcomes", kind: "outcomes" },
    ],
    terminal: [{ label: "Execution engine", kind: "execution-engine" }],
    "feedback-loop": [{ label: "Loop type", kind: "loop-type" }],
    alert: [
      { label: "Severity", kind: "severity" },
      { label: "Channel", kind: "channel" },
    ],
    agent: [
      { label: "Model", kind: "model" },
      { label: "Temperature", kind: "temperature", defaultValue: "0.2" },
    ],
    "integration-tool": [{ label: "Integration type", kind: "integration-type" }],
  };

  return (defaults[iconKey] ?? []).map((preset) => ({
    id: createId("property"),
    name: preset.label,
    value: preset.defaultValue ?? "",
    kind: preset.kind,
    unit: preset.unit,
    currency: preset.currency,
  }));
}

export function stageQuickAddLabel(iconKey: StageKind) {
  const labels: Partial<Record<StageKind, string>> = {
    source: "Input fields",
    transform: "Transform fields",
    database: "Storage fields",
    "human-action": "Human action fields",
    "business-rule": "Rule fields",
    llm: "LLM fields",
    "user-interface": "UI fields",
    decision: "Decision fields",
    terminal: "Automation fields",
    "feedback-loop": "Feedback fields",
    alert: "Alert fields",
    agent: "AI Agent fields",
    "integration-tool": "Integration fields",
  };
  return labels[iconKey] ?? "Stage fields";
}

export const rateLimitUnits = ["req/min", "req/hour"];

/** Everyday source systems for Input stages — not data/cloud platforms. */
export const inputPlatforms = [
  "ServiceNow",
  "Mail",
  "Jira",
  "Confluence",
  "Slack",
  "Microsoft Teams",
  "Salesforce",
  "HubSpot",
  "SharePoint",
  "Google Drive",
  "Zendesk",
  "Workday",
  "SAP",
  "Excel",
  "Web form",
  "API",
  "Other",
];

export const defaultPlatforms = [
  "OpenAI",
  "Anthropic",
  "Google Gemini",
  "Azure OpenAI",
  "AWS Bedrock",
  "Streamlit",
  "Gradio",
  "React",
  "Slack",
  "Microsoft Teams",
  "Salesforce",
  "HubSpot",
  "Snowflake",
  "Databricks",
  "dbt",
  "AWS",
  "Other",
];

export function platformsForStage(iconKey: StageKind): string[] {
  return iconKey === "source" ? inputPlatforms : defaultPlatforms;
}

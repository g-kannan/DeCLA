import Image from "next/image";

type StageIconData = {
  label?: string;
  platform?: string;
  stage_type_key?: string;
  category?: string;
};

type StageIconProps = {
  stage: StageIconData;
  className?: string;
  decorative?: boolean;
};

const ICON_ROOT = "/icons/stages";

const icons = {
  agent: { file: "agent.svg", label: "AI Agent" },
  integrationTool: { file: "integration-tool.svg", label: "Integration/Tool" },
  analytics: { file: "analytics.svg", label: "Analytics" },
  businessRule: { file: "business-rule.svg", label: "Business rule" },
  database: { file: "database.svg", label: "Database" },
  databricks: { file: "databricks.svg", label: "Databricks" },
  decision: { file: "decision.svg", label: "Decision" },
  feedbackLoop: { file: "feedback-loop.svg", label: "Feedback loop" },
  humanAction: { file: "human-action.svg", label: "Human action" },
  iceberg: { file: "iceberg.svg", label: "Iceberg" },
  llm: { file: "llm.svg", label: "Large language model" },
  source: { file: "source.svg", label: "Source" },
  snowflake: { file: "snowflake.svg", label: "Snowflake" },
  terminal: { file: "terminal.svg", label: "Scripts" },
  transform: { file: "transform.svg", label: "Transformation" },
  userInterface: { file: "user-interface.svg", label: "User interface" },
  alert: { file: "alert.svg", label: "Alert" },
} as const;

function iconForStage(stage: StageIconData) {
  const searchable = [stage.label, stage.platform, stage.stage_type_key, stage.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (searchable.includes("databricks")) return icons.databricks;
  if (searchable.includes("iceberg")) return icons.iceberg;
  if (searchable.includes("human-action") || searchable.includes("human action")) return icons.humanAction;
  if (searchable.includes("business-rule") || searchable.includes("business rule")) return icons.businessRule;
  if (searchable.includes("llm") || searchable.includes("large language model")) return icons.llm;
  if (searchable.includes("user-interface") || searchable.includes("user interface") || searchable.includes("streamlit") || searchable.includes("gradio")) return icons.userInterface;
  if (searchable.includes("decision")) return icons.decision;
  if (searchable.includes("feedback-loop") || searchable.includes("feedback loop")) return icons.feedbackLoop;
  if (searchable.includes("alert")) return icons.alert;
  if (searchable.includes("integration-tool") || searchable.includes("integration tool")) return icons.integrationTool;
  if (searchable.includes("agent")) return icons.agent;
  if (searchable.includes("snowsql") || searchable.includes("terminal") || searchable.includes("script")) {
    return icons.terminal;
  }
  if (searchable.includes("snowflake")) return icons.snowflake;
  if (
    searchable.includes("microstrategy") ||
    searchable.includes("dashboard") ||
    searchable.includes("report") ||
    searchable.includes("consume") ||
    searchable.includes("serve")
  ) {
    return icons.analytics;
  }
  if (
    searchable.includes("database") ||
    searchable.includes("warehouse") ||
    searchable.includes("table") ||
    searchable.includes("store") ||
    searchable.includes("load") ||
    searchable.includes("ingest")
  ) {
    return icons.database;
  }
  if (searchable.includes("transform")) return icons.transform;
  return icons.source;
}

export function StageIcon({ stage, className = "", decorative = true }: StageIconProps) {
  const icon = iconForStage(stage);

  return (
    <span className={`stage-icon ${className}`.trim()} title={decorative ? icon.label : undefined}>
      <Image
        src={`${ICON_ROOT}/${icon.file}`}
        alt={decorative ? "" : icon.label}
        aria-hidden={decorative || undefined}
        width={40}
        height={40}
        unoptimized
      />
    </span>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { AppShell } from "@/app/components/app-shell";
import { SearchableSelect } from "@/app/components/searchable-select";
import { StagePropertyRow } from "@/app/components/stage-property-row";
import { CANVAS_STORAGE_KEY, nextCanvasVersion, normalizeCanvasEdges, normalizeCanvasStages, readCanvasVersions, writeCanvasDraft, writeCanvasVersions, type CanvasEdge, type CanvasEdgeLineStyle, type CanvasEnvironment, type CanvasStage, type CanvasStatus, type CanvasVersion, type StageProperty } from "@/lib/local-canvas";
import { defaultStageProperties, platformsForStage, propertyKind, stageConfigNotes, stagePropertyPresets, stageQuickAddLabel, universalPropertyPresets, type PropertyPreset, type StageKind } from "@/lib/stage-properties";
import { StageIcon } from "@/lib/stage-icons";
import { useToastMessage } from "@/lib/use-toast-message";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import { FlowCanvas, getAutoLayout } from "./flow-canvas";

const stageTypes: { label: string; key: StageKind; color: string }[] = [
  { label: "Input", key: "source", color: "#2A2ACF" },
  { label: "Transform", key: "transform", color: "#F36A10" },
  { label: "Storage", key: "database", color: "#2A2ACF" },
  { label: "Human Action", key: "human-action", color: "#7C3AED" },
  { label: "Business Rule", key: "business-rule", color: "#0891B2" },
  { label: "LLM", key: "llm", color: "#DB2777" },
  { label: "User Interface", key: "user-interface", color: "#16A34A" },
  { label: "Decision", key: "decision", color: "#F36A10" },
  { label: "Automation", key: "terminal", color: "#2A2ACF" },
  { label: "Feedback Loop", key: "feedback-loop", color: "#0F766E" },
  { label: "Alert", key: "alert", color: "#DC2626" },
  { label: "AI Agent", key: "agent", color: "#7C3AED" },
  { label: "Integration/Tool", key: "integration-tool", color: "#2563EB" },
];

const durationUnits = ["mins", "hours", "days"];
const currencies = ["USD", "EUR", "GBP", "INR"];
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
// Weekly forecast analysis AI workflow using LangGraph and Gemini AI within Databricks.
const seedStages: CanvasStage[] = [
  {
    id: "forecast-ingestion",
    name: "Ingest weekly forecast files",
    type: "Input",
    platform: "SharePoint",
    iconKey: "source",
    color: "#2A2ACF",
    x: 350,
    y: 0,
    properties: [
      { id: "ingest-files", name: "Data source", value: "Weekly forecast files (latest week vs WoW & YoY)", kind: "custom" },
      { id: "ingest-scale", name: "Volume", value: "Millions of forecast rows", kind: "rows", unit: "rows" },
      { id: "ingest-owner", name: "Owner", value: "Data Engineering", kind: "owner" },
      { id: "ingest-duration", name: "Duration", value: "15", kind: "duration", unit: "mins" },
    ],
  },
  {
    id: "data-privacy-masking",
    name: "Mask sensitive identifiers",
    type: "Transform",
    platform: "Databricks",
    iconKey: "transform",
    color: "#F36A10",
    x: 350,
    y: 120,
    properties: [
      { id: "masking-rule", name: "Privacy rule", value: "Mask factory codes, country codes, & material numbers", kind: "custom" },
      { id: "masking-audit", name: "Audit trail", value: "Unity Catalog lineage and column masking", kind: "custom" },
      { id: "masking-guardrail", name: "Guardrail", value: "Zero unmasked sensitive identifiers sent to LLM", kind: "custom" },
    ],
  },
  {
    id: "delta-lake-storage",
    name: "Store in Delta Lake & Unity Catalog",
    type: "Storage",
    platform: "Databricks",
    iconKey: "database",
    color: "#2A2ACF",
    x: 350,
    y: 240,
    properties: [
      { id: "delta-warehouse", name: "Storage engine", value: "Databricks Delta Lake tables", kind: "custom" },
      { id: "delta-levels", name: "Analysis levels", value: "1. Total volume | 2. Country sourcing | 3. Factory/Item | 4. Lifecycle", kind: "custom" },
      { id: "delta-audit", name: "Governance", value: "Full Unity Catalog security and audit trail", kind: "custom" },
    ],
  },
  {
    id: "hypothesis-input",
    name: "Add freeform hypothesis statements",
    type: "Human Action",
    platform: "Other",
    iconKey: "human-action",
    color: "#7C3AED",
    x: 700,
    y: 120,
    properties: [
      { id: "hypo-method", name: "Input mode", value: "Plain language statements with zero code changes", kind: "custom" },
      { id: "hypo-owner", name: "Owner", value: "Business Users & Demand Planners", kind: "owner" },
      { id: "hypo-scope", name: "Impact", value: "Expands coverage to new questions, brands, or verticals", kind: "custom" },
      { id: "hypo-sla", name: "SLA", value: "1", kind: "sla", unit: "hours" },
    ],
  },
  {
    id: "knowledge-graph-store",
    name: "Knowledge graph & hypothesis store",
    type: "Storage",
    platform: "Databricks",
    iconKey: "database",
    color: "#0284C7",
    x: 700,
    y: 240,
    properties: [
      { id: "kg-schema", name: "Graph schema", value: "Domain knowledge graph & plain-language hypotheses", kind: "custom" },
      { id: "kg-scale", name: "Scalability", value: "Scalable by design for instant analytical expansion", kind: "custom" },
    ],
  },
  {
    id: "privacy-compliance-gate",
    name: "Is data privacy control enforced?",
    type: "Business Rule",
    platform: "Databricks",
    iconKey: "business-rule",
    color: "#0891B2",
    x: 350,
    y: 380,
    properties: [
      { id: "privacy-rule", name: "Gate", value: "Verify factory, country, & material masks before LLM payload", kind: "custom" },
      { id: "privacy-outcomes", name: "Outcomes", value: "Pass | Compliance hold", kind: "custom" },
      { id: "privacy-audit", name: "Audit record", value: "Unity Catalog compliance verification log", kind: "custom" },
    ],
  },
  {
    id: "hypothesis-updated-decision",
    name: "D1: Are new hypotheses registered?",
    type: "Decision",
    platform: "Other",
    iconKey: "decision",
    color: "#F36A10",
    x: 525,
    y: 520,
    properties: [
      { id: "d1-1", name: "Question", value: "Are new plain-language business hypotheses in Knowledge Graph?", kind: "custom" },
      { id: "d1-2", name: "Outcomes", value: "New hypothesis loaded | Standard 20+ questions run", kind: "custom" },
      { id: "d1-3", name: "Expansion route", value: "Dynamically append hypothesis context to LangGraph query plan", kind: "custom" },
    ],
  },
  {
    id: "langgraph-gemini-sql-gen",
    name: "LangGraph & Gemini AI SQL generation",
    type: "LLM",
    platform: "Google Gemini",
    iconKey: "llm",
    color: "#DB2777",
    x: 525,
    y: 660,
    properties: [
      { id: "lg-1", name: "Task", value: "Dynamically generate & execute SQL for 20+ business questions", kind: "custom" },
      { id: "lg-2", name: "Orchestration", value: "LangGraph agentic workflow inside Databricks", kind: "custom" },
      { id: "lg-3", name: "Inputs", value: "Masked forecast rows & active knowledge graph hypotheses", kind: "custom" },
      { id: "lg-4", name: "Guardrail", value: "No unmasked factory, country, or material identifiers", kind: "custom" },
    ],
  },
  {
    id: "sql-execution-breach-flagging",
    name: "Execute SQL & flag threshold breaches",
    type: "Automation",
    platform: "Databricks",
    iconKey: "terminal",
    color: "#2A2ACF",
    x: 525,
    y: 800,
    properties: [
      { id: "se-1", name: "Execution", value: "Databricks SQL Warehouse against millions of rows", kind: "custom" },
      { id: "se-2", name: "4 Levels", value: "Volume trends, country sourcing, factory/item, & product lifecycle", kind: "custom" },
      { id: "se-3", name: "Breach detection", value: "Automated variance & threshold breach flagging", kind: "custom" },
    ],
  },
  {
    id: "breach-detection-decision",
    name: "D2: Were threshold breaches flagged?",
    type: "Decision",
    platform: "Other",
    iconKey: "decision",
    color: "#F36A10",
    x: 525,
    y: 940,
    properties: [
      { id: "d2-1", name: "Question", value: "Do WoW or YoY forecast changes exceed anomaly thresholds?", kind: "custom" },
      { id: "d2-2", name: "Outcomes", value: "Breach flagged (Detailed narrative) | Normal variance", kind: "custom" },
      { id: "d2-3", name: "Flagged route", value: "Trigger deep-dive root cause analysis narrative", kind: "custom" },
    ],
  },
  {
    id: "narrative-generation",
    name: "Produce business narrative insights",
    type: "LLM",
    platform: "Google Gemini",
    iconKey: "llm",
    color: "#DB2777",
    x: 525,
    y: 1080,
    properties: [
      { id: "narr-1", name: "Task", value: "Synthesize 4-level findings into executive narrative & key drivers", kind: "custom" },
      { id: "narr-2", name: "Output", value: "Plain-language business story with root-cause insights", kind: "custom" },
      { id: "narr-3", name: "Guardrail", value: "Strict grounding in executed SQL query results", kind: "custom" },
    ],
  },
  {
    id: "excel-report-generation",
    name: "Generate multi-tab Excel report",
    type: "Automation",
    platform: "Other",
    iconKey: "terminal",
    color: "#2A2ACF",
    x: 525,
    y: 1220,
    properties: [
      { id: "xls-1", name: "Report tabs", value: "Executive Summary, 4 Level Drill-downs, & SQL Audit Log", kind: "custom" },
      { id: "xls-2", name: "Formatting", value: "Colour-coded variance highlights & breach callouts", kind: "custom" },
      { id: "xls-3", name: "Delivery SLA", value: "Distributed automatically within hours", kind: "custom" },
    ],
  },
  {
    id: "insights-distribution-portal",
    name: "Deliver Excel report & audit portal",
    type: "User Interface",
    platform: "Streamlit",
    iconKey: "user-interface",
    color: "#16A34A",
    x: 350,
    y: 1360,
    properties: [
      { id: "dis-1", name: "Channels", value: "Automated email distribution & web download portal", kind: "custom" },
      { id: "dis-2", name: "Views", value: "Colour-coded Excel, Executive Summary, & SQL Audit Log", kind: "custom" },
    ],
  },
  {
    id: "executive-review",
    name: "Review report & execute actions",
    type: "Human Action",
    platform: "Other",
    iconKey: "human-action",
    color: "#7C3AED",
    x: 350,
    y: 1500,
    properties: [
      { id: "rev-1", name: "Audience", value: "Supply Chain Directors & Demand Planning Leadership", kind: "owner" },
      { id: "rev-2", name: "Action", value: "Validate sourcing shifts, factory adjustments & lifecycle decisions", kind: "custom" },
      { id: "rev-3", name: "SLA", value: "4", kind: "sla", unit: "hours" },
    ],
  },
  {
    id: "unity-catalog-audit-log",
    name: "Persist Unity Catalog audit log",
    type: "Storage",
    platform: "Databricks",
    iconKey: "database",
    color: "#2A2ACF",
    x: 700,
    y: 1360,
    properties: [
      { id: "aud-1", name: "Audit log", value: "Full SQL query log, LLM prompts, masked maps, & execution times", kind: "custom" },
      { id: "aud-2", name: "Governance", value: "Zero manual intervention automated audit trail", kind: "custom" },
    ],
  },
];

const seedEdges: CanvasEdge[] = [
  { id: "fe-1-2", fromStageId: "forecast-ingestion", toStageId: "data-privacy-masking" },
  { id: "fe-2-3", fromStageId: "data-privacy-masking", toStageId: "delta-lake-storage" },
  { id: "fe-4-5", fromStageId: "hypothesis-input", toStageId: "knowledge-graph-store" },
  { id: "fe-3-6", fromStageId: "delta-lake-storage", toStageId: "privacy-compliance-gate" },
  { id: "fe-5-7", fromStageId: "knowledge-graph-store", toStageId: "hypothesis-updated-decision" },
  { id: "fe-6-7", fromStageId: "privacy-compliance-gate", toStageId: "hypothesis-updated-decision", label: "Pass", color: "#16a34a" },
  { id: "fe-7-8a", fromStageId: "hypothesis-updated-decision", toStageId: "langgraph-gemini-sql-gen", label: "New hypothesis", color: "#16a34a" },
  { id: "fe-7-8b", fromStageId: "hypothesis-updated-decision", toStageId: "langgraph-gemini-sql-gen", label: "Standard 20+ questions", color: "#2a2acf" },
  { id: "fe-8-9", fromStageId: "langgraph-gemini-sql-gen", toStageId: "sql-execution-breach-flagging" },
  { id: "fe-9-10", fromStageId: "sql-execution-breach-flagging", toStageId: "breach-detection-decision" },
  { id: "fe-10-11a", fromStageId: "breach-detection-decision", toStageId: "narrative-generation", label: "Breach flagged", color: "#f36a10" },
  { id: "fe-10-11b", fromStageId: "breach-detection-decision", toStageId: "narrative-generation", label: "Normal variance", color: "#16a34a" },
  { id: "fe-11-12", fromStageId: "narrative-generation", toStageId: "excel-report-generation" },
  { id: "fe-12-13", fromStageId: "excel-report-generation", toStageId: "insights-distribution-portal" },
  { id: "fe-13-14", fromStageId: "insights-distribution-portal", toStageId: "executive-review" },
  { id: "fe-12-15", fromStageId: "excel-report-generation", toStageId: "unity-catalog-audit-log" },
];

const returnRequestSeedStages: CanvasStage[] = [
  {
    id: "ret-customer-submits",
    name: "Customer submits return request",
    type: "User Interface",
    platform: "Streamlit",
    iconKey: "user-interface",
    color: "#16A34A",
    x: 350,
    y: 0,
    properties: [
      { id: "ret-1-1", name: "Required data", value: "Order ID, Item ID, Reason, Photo evidence", kind: "custom" },
    ],
  },
  {
    id: "ret-agent-reads",
    name: "Agent reads the request",
    type: "LLM",
    platform: "OpenAI",
    iconKey: "llm",
    color: "#DB2777",
    x: 350,
    y: 120,
    properties: [
      { id: "ret-2-1", name: "Task", value: "Parse customer request and extract return intent", kind: "custom" },
    ],
  },
  {
    id: "ret-retrieves-data",
    name: "Retrieves order and customer data",
    type: "Storage",
    platform: "Snowflake",
    iconKey: "database",
    color: "#2A2ACF",
    x: 350,
    y: 240,
    properties: [
      { id: "ret-3-1", name: "Data sources", value: "Order DB, Customer profile, Delivery records", kind: "custom" },
    ],
  },
  {
    id: "ret-d1-order-valid",
    name: "D1: Is the order valid?",
    type: "Decision",
    platform: "Other",
    iconKey: "decision",
    color: "#F36A10",
    x: 350,
    y: 380,
    properties: [
      { id: "ret-4-1", name: "Question", value: "Is the order ID active and purchase verified?", kind: "custom" },
      { id: "ret-4-2", name: "Outcomes", value: "Yes | No", kind: "custom" },
    ],
  },
  {
    id: "ret-4a-ask-or-reject",
    name: "Ask for more information or reject",
    type: "Human Action",
    platform: "Slack",
    iconKey: "human-action",
    color: "#7C3AED",
    x: 50,
    y: 380,
    properties: [
      { id: "ret-4a-1", name: "Action", value: "Request order details or issue rejection notice", kind: "custom" },
    ],
  },
  {
    id: "ret-d2-item-eligible",
    name: "D2: Is the item return-eligible?",
    type: "Decision",
    platform: "Other",
    iconKey: "decision",
    color: "#F36A10",
    x: 650,
    y: 380,
    properties: [
      { id: "ret-5-1", name: "Question", value: "Is within 30-day return window and non-final sale?", kind: "custom" },
      { id: "ret-5-2", name: "Outcomes", value: "Yes | No", kind: "custom" },
    ],
  },
  {
    id: "ret-5a-explain-policy",
    name: "Explain policy and close case",
    type: "Human Action",
    platform: "Other",
    iconKey: "human-action",
    color: "#7C3AED",
    x: 650,
    y: 520,
    properties: [
      { id: "ret-5a-1", name: "Action", value: "Send policy explanation to customer and close case", kind: "custom" },
    ],
  },
  {
    id: "ret-d3-reason-for-return",
    name: "D3: What is the reason for return?",
    type: "Decision",
    platform: "Other",
    iconKey: "decision",
    color: "#F36A10",
    x: 950,
    y: 380,
    properties: [
      { id: "ret-6-1", name: "Question", value: "What is the customer-reported reason for return?", kind: "custom" },
      { id: "ret-6-2", name: "Outcomes", value: "Damaged product | Wrong product | Change of mind", kind: "custom" },
    ],
  },
  {
    id: "ret-6a-create-replacement",
    name: "Create replacement / claim",
    type: "Automation",
    platform: "Other",
    iconKey: "terminal",
    color: "#2A2ACF",
    x: 1250,
    y: 100,
    properties: [
      { id: "ret-6a-1", name: "Action", value: "Generate damage claim and initiate replacement order", kind: "custom" },
    ],
  },
  {
    id: "ret-6b-priority-replacement",
    name: "Arrange priority replacement",
    type: "Automation",
    platform: "Other",
    iconKey: "terminal",
    color: "#2A2ACF",
    x: 1250,
    y: 330,
    properties: [
      { id: "ret-6b-1", name: "Action", value: "Dispatch wrong-item return label & priority replacement", kind: "custom" },
    ],
  },
  {
    id: "ret-6c-standard-return",
    name: "Start standard return",
    type: "Automation",
    platform: "Other",
    iconKey: "terminal",
    color: "#2A2ACF",
    x: 1250,
    y: 560,
    properties: [
      { id: "ret-6c-1", name: "Action", value: "Generate standard return label and RMA tracking number", kind: "custom" },
    ],
  },
  {
    id: "ret-d4-auto-refund",
    name: "D4: Is an automatic refund permitted?",
    type: "Decision",
    platform: "Other",
    iconKey: "decision",
    color: "#F36A10",
    x: 950,
    y: 880,
    properties: [
      { id: "ret-7-1", name: "Question", value: "Does transaction pass automatic refund risk checks?", kind: "custom" },
      { id: "ret-7-2", name: "Outcomes", value: "Low-value, low-risk | High-value item | Suspicious pattern", kind: "custom" },
    ],
  },
  {
    id: "ret-7a-approve-auto",
    name: "Approve refund automatically",
    type: "Automation",
    platform: "Other",
    iconKey: "terminal",
    color: "#2A2ACF",
    x: 1250,
    y: 790,
    properties: [
      { id: "ret-7a-1", name: "Action", value: "Issue instant automated refund to payment method", kind: "custom" },
    ],
  },
  {
    id: "ret-7b-human-approval",
    name: "Send for human approval",
    type: "Human Action",
    platform: "Other",
    iconKey: "human-action",
    color: "#7C3AED",
    x: 1250,
    y: 1020,
    properties: [
      { id: "ret-7b-1", name: "Owner", value: "Customer Support Lead", kind: "owner" },
    ],
  },
  {
    id: "ret-7c-fraud-review",
    name: "Send to fraud review",
    type: "Human Action",
    platform: "Other",
    iconKey: "human-action",
    color: "#7C3AED",
    x: 1250,
    y: 1250,
    properties: [
      { id: "ret-7c-1", name: "Owner", value: "Fraud Operations Team", kind: "owner" },
    ],
  },
  {
    id: "ret-8-execute-action",
    name: "Agent executes the approved action",
    type: "Automation",
    platform: "Other",
    iconKey: "terminal",
    color: "#2A2ACF",
    x: 350,
    y: 1150,
    properties: [
      { id: "ret-8-1", name: "Task", value: "Execute approved return, replacement, or review action", kind: "custom" },
    ],
  },
  {
    id: "ret-9-update-system",
    name: "Updates order system, sends message",
    type: "Storage",
    platform: "Salesforce",
    iconKey: "database",
    color: "#059669",
    x: 350,
    y: 1380,
    properties: [
      { id: "ret-9-1", name: "Target", value: "Update OMS status & notify customer via email/SMS", kind: "custom" },
    ],
  },
  {
    id: "ret-10-records-audit",
    name: "Records audit trail and analytics",
    type: "Storage",
    platform: "Snowflake",
    iconKey: "database",
    color: "#0284C7",
    x: 350,
    y: 1610,
    properties: [
      { id: "ret-10-1", name: "Log", value: "Log governance audit trail to Snowflake data warehouse", kind: "custom" },
    ],
  },
  {
    id: "ret-11-case-completed",
    name: "Return case completed",
    type: "User Interface",
    platform: "Streamlit",
    iconKey: "user-interface",
    color: "#059669",
    x: 350,
    y: 1840,
    properties: [
      { id: "ret-11-1", name: "Status", value: "Resolution complete and case closed", kind: "custom" },
    ],
  },
];

const returnRequestSeedEdges: CanvasEdge[] = [
  { id: "e1-2", fromStageId: "ret-customer-submits", toStageId: "ret-agent-reads" },
  { id: "e2-3", fromStageId: "ret-agent-reads", toStageId: "ret-retrieves-data" },
  { id: "e3-4", fromStageId: "ret-retrieves-data", toStageId: "ret-d1-order-valid" },
  { id: "e4-4a", fromStageId: "ret-d1-order-valid", toStageId: "ret-4a-ask-or-reject", label: "No", color: "#dc2626" },
  { id: "e4-5", fromStageId: "ret-d1-order-valid", toStageId: "ret-d2-item-eligible", label: "Yes", color: "#16a34a" },
  { id: "e4a-8", fromStageId: "ret-4a-ask-or-reject", toStageId: "ret-8-execute-action" },
  { id: "e5-5a", fromStageId: "ret-d2-item-eligible", toStageId: "ret-5a-explain-policy", label: "No", color: "#dc2626" },
  { id: "e5-6", fromStageId: "ret-d2-item-eligible", toStageId: "ret-d3-reason-for-return", label: "Yes", color: "#16a34a" },
  { id: "e5a-8", fromStageId: "ret-5a-explain-policy", toStageId: "ret-8-execute-action" },
  { id: "e6-6a", fromStageId: "ret-d3-reason-for-return", toStageId: "ret-6a-create-replacement", label: "Damaged product", color: "#16a34a" },
  { id: "e6-6b", fromStageId: "ret-d3-reason-for-return", toStageId: "ret-6b-priority-replacement", label: "Wrong product", color: "#16a34a" },
  { id: "e6-6c", fromStageId: "ret-d3-reason-for-return", toStageId: "ret-6c-standard-return", label: "Change of mind", color: "#16a34a" },
  { id: "e6a-7", fromStageId: "ret-6a-create-replacement", toStageId: "ret-d4-auto-refund" },
  { id: "e6b-7", fromStageId: "ret-6b-priority-replacement", toStageId: "ret-d4-auto-refund" },
  { id: "e6c-7", fromStageId: "ret-6c-standard-return", toStageId: "ret-d4-auto-refund" },
  { id: "e7-7a", fromStageId: "ret-d4-auto-refund", toStageId: "ret-7a-approve-auto", label: "Low-value, low-risk", color: "#16a34a" },
  { id: "e7-7b", fromStageId: "ret-d4-auto-refund", toStageId: "ret-7b-human-approval", label: "High-value item", color: "#f36a10" },
  { id: "e7-7c", fromStageId: "ret-d4-auto-refund", toStageId: "ret-7c-fraud-review", label: "Suspicious pattern", color: "#f36a10" },
  { id: "e7a-8", fromStageId: "ret-7a-approve-auto", toStageId: "ret-8-execute-action" },
  { id: "e7b-8", fromStageId: "ret-7b-human-approval", toStageId: "ret-8-execute-action" },
  { id: "e7c-8", fromStageId: "ret-7c-fraud-review", toStageId: "ret-8-execute-action" },
  { id: "e8-9", fromStageId: "ret-8-execute-action", toStageId: "ret-9-update-system" },
  { id: "e9-10", fromStageId: "ret-9-update-system", toStageId: "ret-10-audit-trail" },
  { id: "e10-11", fromStageId: "ret-10-audit-trail", toStageId: "ret-11-case-completed" },
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
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [edgeLineStyle, setEdgeLineStyle] = useState<CanvasEdgeLineStyle>("smoothstep");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPropertyMenu, setShowPropertyMenu] = useState(false);
  const { message, setMessage, clearMessage } = useToastMessage();
  const [hydrated, setHydrated] = useState(false);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExamplesMenu, setShowExamplesMenu] = useState(false);
  const [showArrangeMenu, setShowArrangeMenu] = useState(false);
  const [showLineStyleMenu, setShowLineStyleMenu] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [versionTags, setVersionTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const closeFloatingMenus = useCallback(() => {
    setShowAddMenu(false);
    setShowPropertyMenu(false);
    setShowExportMenu(false);
    setShowExamplesMenu(false);
    setShowArrangeMenu(false);
    setShowLineStyleMenu(false);
  }, []);

  function toggleExclusiveMenu(isOpen: boolean, setOpen: (open: boolean) => void) {
    if (isOpen) {
      setOpen(false);
      return;
    }
    closeFloatingMenus();
    setOpen(true);
  }

  const addStageMenuRef = useDismissOnOutsideClick(showAddMenu, () => setShowAddMenu(false));
  const arrangeMenuRef = useDismissOnOutsideClick(showArrangeMenu, () => setShowArrangeMenu(false));
  const lineStyleMenuRef = useDismissOnOutsideClick(showLineStyleMenu, () => setShowLineStyleMenu(false));
  const examplesMenuRef = useDismissOnOutsideClick(showExamplesMenu, () => setShowExamplesMenu(false));
  const exportMenuRef = useDismissOnOutsideClick(showExportMenu, () => setShowExportMenu(false));
  const propertyMenuRef = useDismissOnOutsideClick(showPropertyMenu, () => setShowPropertyMenu(false));

  const searchMatchSet = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return new Set<string>();

    let decisionIndex = 0;
    const matches = new Set<string>();

    stages.forEach((stage, idx) => {
      if (stage.iconKey === "decision") {
        decisionIndex++;
      }
      const stageNumStr = String(idx + 1);
      const stageNumPad = stageNumStr.padStart(2, "0");
      const decisionTag = stage.iconKey === "decision" ? `d${decisionIndex}` : "";

      const nameMatch = stage.name.toLowerCase().includes(query);
      const typeMatch = stage.type.toLowerCase().includes(query);
      const platformMatch = stage.platform.toLowerCase().includes(query);
      const iconMatch = stage.iconKey.toLowerCase().includes(query);
      const indexMatch =
        query === stageNumStr ||
        query === stageNumPad ||
        query === `stage ${stageNumStr}` ||
        query === `stage ${stageNumPad}` ||
        (decisionTag && (query === decisionTag || query === `decision ${decisionIndex}`));

      const propMatch = stage.properties.some((p) =>
        p.name.toLowerCase().includes(query) ||
        p.value.toLowerCase().includes(query) ||
        (p.unit && p.unit.toLowerCase().includes(query)) ||
        (p.currency && p.currency.toLowerCase().includes(query))
      );

      if (nameMatch || typeMatch || platformMatch || iconMatch || indexMatch || propMatch) {
        matches.add(stage.id);
      }
    });

    return matches;
  }, [searchQuery, stages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          if (target === searchInputRef.current) return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allTagOptions = useMemo(() => {
    const combined = new Set([...versionTagOptions, ...customTags, ...versionTags]);
    return Array.from(combined);
  }, [customTags, versionTags]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(CANVAS_STORAGE_KEY);
      const localVersions = readCanvasVersions();
      setVersions(localVersions);
      setVersionTags(localVersions[0]?.tags ?? []);
      if (saved) {
        try {
          const draft = JSON.parse(saved) as { name?: string; status?: CanvasStatus; environment?: CanvasEnvironment; goLiveDate?: string; budget?: string; budgetCurrency?: string; sla?: string; slaUnit?: string; stages?: CanvasStage[]; edges?: CanvasEdge[]; edgeLineStyle?: CanvasEdgeLineStyle };
          if (draft.name) setProcessName(draft.name);
          if (draft.status && statusOptions.some((option) => option.value === draft.status)) setProjectStatus(draft.status);
          if (draft.environment && environmentOptions.some((option) => option.value === draft.environment)) setEnvironment(draft.environment);
          if (draft.goLiveDate !== undefined) setGoLiveDate(draft.goLiveDate);
          if (draft.budget !== undefined) setProjectBudget(draft.budget);
          if (draft.budgetCurrency) setBudgetCurrency(draft.budgetCurrency);
          if (draft.sla !== undefined) setProjectSla(draft.sla);
          if (draft.slaUnit) setProjectSlaUnit(draft.slaUnit);
          if (draft.edgeLineStyle) setEdgeLineStyle(draft.edgeLineStyle);
          if (draft.stages?.length) {
            const normalizedStages = normalizeCanvasStages(draft.stages);
            setStages(normalizedStages);
            setSelectedId(null);
            setEdges(normalizeCanvasEdges(normalizedStages, draft.edges));
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
    writeCanvasDraft({ name: processName, status: projectStatus, environment, goLiveDate, budget: projectBudget, budgetCurrency, sla: projectSla, slaUnit: projectSlaUnit, stages, edges, edgeLineStyle });
  }, [budgetCurrency, edges, edgeLineStyle, environment, goLiveDate, hydrated, processName, projectBudget, projectSla, projectSlaUnit, projectStatus, stages]);

  const selectedStage = stages.find((stage) => stage.id === selectedId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
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
    let nextName = selectedStage?.name;
    if (key === "decision" && selectedStage && (!selectedStage.name || selectedStage.name.startsWith("New ") || selectedStage.name === "Untitled")) {
      const decisionCount = stages.filter((s) => s.iconKey === "decision" && s.id !== selectedStage.id).length + 1;
      nextName = `Decision d${decisionCount}`;
    }
    const typeDefaults = selectedStage?.properties.length === 0 ? defaultStageProperties(key, createId) : undefined;
    updateStage({ type: next.label, iconKey: next.key, color: next.color, ...(nextName ? { name: nextName } : {}), ...(typeDefaults ? { properties: typeDefaults } : {}) });
  }

  function addStage(kind: (typeof stageTypes)[number]) {
    let x = 100;
    let y = 100;
    if (stages.length > 0) {
      const refStage = selectedStage ?? stages.reduce((max, s) => ((s.x ?? 0) > (max.x ?? 0) ? s : max), stages[0]);
      const refX = refStage.x ?? 0;
      const refY = refStage.y ?? 0;
      const refWidth = refStage.iconKey === "decision" ? 210 : 188;
      x = refX + refWidth + 70;
      y = refY;
    }

    const decisionCount = stages.filter((s) => s.iconKey === "decision").length + 1;
    const defaultName = kind.key === "decision" ? `Decision d${decisionCount}` : `New ${kind.label.toLowerCase()}`;

    const next: CanvasStage = {
      id: createId("stage"),
      name: kind.key === "agent" ? "New AI Agent" : defaultName,
      type: kind.label,
      platform: "Other",
      iconKey: kind.key,
      color: kind.color,
      properties: defaultStageProperties(kind.key, createId),
      x,
      y,
    };
    setStages((current) => [...current, next]);
    setSelectedId(next.id);
    setShowAddMenu(false);
    setMessage(kind.key === "decision" ? `Decision d${decisionCount} added to process` : "Stage added to the process");
  }

  function removeSelected() {
    if (!selectedStage) return;
    const next = stages.filter((stage) => stage.id !== selectedStage.id);
    // Remove any edges that referenced the deleted stage
    setEdges((prev) => prev.filter((e) => e.fromStageId !== selectedStage.id && e.toStageId !== selectedStage.id));
    setStages(next);
    setSelectedId(next[Math.max(0, stages.findIndex((stage) => stage.id === selectedStage.id) - 1)]?.id ?? null);
    setMessage("Stage removed");
  }

  // ── Edge handlers ──────────────────────────────────────────────────────────

  function handleEdgeCreated(edge: CanvasEdge) {
    setEdges((prev) => [...prev, edge]);
  }

  function handleEdgeDeleted(id: string) {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    if (selectedEdgeId === id) setSelectedEdgeId(null);
  }

  function updateEdge(id: string, patch: Partial<CanvasEdge>) {
    setEdges((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e));
  }

  function handleStagePositionsChange(updates: { id: string; x: number; y: number }[]) {
    setStages((prev) => prev.map((s) => {
      const update = updates.find((u) => u.id === s.id);
      return update ? { ...s, x: update.x, y: update.y } : s;
    }));
  }

  function handleAutoArrange(rankdir: "TB" | "LR") {
    const arranged = getAutoLayout(stages, edges, rankdir, 85, 100);
    setStages((current) =>
      current.map((stage) => {
        const pos = arranged.get(stage.id);
        return pos ? { ...stage, x: pos.x, y: pos.y } : stage;
      }),
    );
    setShowArrangeMenu(false);
    setMessage(`Auto-arrange applied (${rankdir === "TB" ? "Vertical" : "Horizontal"})`);
  }

  function handleSpaciousArrange() {
    const arranged = getAutoLayout(stages, edges, "LR", 115, 140);
    setStages((current) =>
      current.map((stage) => {
        const pos = arranged.get(stage.id);
        return pos ? { ...stage, x: pos.x, y: pos.y } : stage;
      }),
    );
    setShowArrangeMenu(false);
    setMessage("Spacious auto-arrange applied (zero overlap)");
  }

  function addProperty(definition?: PropertyPreset) {
    if (!selectedStage) return;
    const baseName = definition?.label ?? "New property";
    const existingNames = new Set(selectedStage.properties.map((property) => property.name.toLowerCase()));
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name.toLowerCase())) name = `${baseName} ${suffix++}`;
    const property = { id: createId("property"), name, value: definition?.defaultValue ?? "", kind: definition?.kind ?? "custom", unit: definition?.unit, currency: definition?.currency };
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
    const draft = { name: processName.trim(), status: projectStatus, environment, goLiveDate, budget: projectBudget, budgetCurrency, sla: projectSla, slaUnit: projectSlaUnit, stages, edges, edgeLineStyle };
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
      const payload = JSON.parse(await file.text()) as { format?: string; canvas?: { name?: string; status?: CanvasStatus; environment?: CanvasEnvironment; goLiveDate?: string; budget?: string; budgetCurrency?: string; sla?: string; slaUnit?: string; stages?: CanvasStage[]; edges?: CanvasEdge[]; edgeLineStyle?: CanvasEdgeLineStyle }; versions?: CanvasVersion[] };
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
      if (draft.edgeLineStyle) setEdgeLineStyle(draft.edgeLineStyle);
      const normalizedStages = normalizeCanvasStages(draft.stages);
      const normalizedEdges = normalizeCanvasEdges(normalizedStages, draft.edges);
      setStages(normalizedStages);
      setSelectedId(null);
      setEdges(normalizedEdges);
      const importedVersions = Array.isArray(payload.versions) ? payload.versions.map((version) => ({ ...version, environment: version.environment ?? "development" as const, goLiveDate: version.goLiveDate ?? "", tags: Array.isArray(version.tags) ? version.tags : [], stages: normalizeCanvasStages(version.stages ?? []), edges: normalizeCanvasEdges(version.stages ?? [], version.edges) })) : [];
      setVersions(importedVersions);
      setVersionTags(importedVersions[0]?.tags ?? []);
      writeCanvasDraft({ name: draft.name ?? "", status: importedStatus, environment: draft.environment ?? "development", goLiveDate: draft.goLiveDate ?? "", budget: draft.budget ?? "", budgetCurrency: draft.budgetCurrency ?? "USD", sla: draft.sla ?? "", slaUnit: draft.slaUnit ?? "days", stages: normalizedStages, edges: normalizedEdges });
      writeCanvasVersions(importedVersions);
      setMessage(".decla file imported");
    } catch {
      setMessage("This .decla file could not be imported");
    }
  }

  function toggleVersionTag(tag: string) {
    setVersionTags((current) => (current.includes(tag) ? [] : [tag]));
  }

  function handleAddCustomTag(event?: React.FormEvent) {
    if (event) event.preventDefault();
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!versionTagOptions.includes(trimmed) && !customTags.includes(trimmed)) {
      setCustomTags((current) => [...current, trimmed]);
    }
    setVersionTags([trimmed]);
    setCustomTagInput("");
    setShowCustomTagInput(false);
    setMessage(`Version tag "${trimmed}" selected`);
  }

  function exportFileName(extension: string) {
    const base = processName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled-decision-canvas";
    return `${base}.${extension}`;
  }

  function escapeXml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
  }

function getNodeHandlePos(stage: CanvasStage, handleId?: string, isTarget?: boolean) {
  const isDecision = stage.iconKey === "decision";
  const nw = isDecision ? 210 : 188;
  const nh = isDecision ? 210 : 190;
  const nx = stage.x ?? 0;
  const ny = stage.y ?? 0;

  if (isTarget) {
    return { x: nx, y: ny + nh / 2 };
  }
  if (isDecision && handleId === "bottom") {
    return { x: nx + nw / 2, y: ny + nh };
  }
  return { x: nx + nw, y: ny + nh / 2 };
}

function getEdgeSvgPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  lineType: string = "smoothstep",
) {
  if (lineType === "straight") {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  if (lineType === "bezier") {
    const dx = Math.abs(tx - sx) * 0.5;
    return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
  }

  if (sx < tx) {
    const midX = Math.round(sx + (tx - sx) / 2);
    if (Math.abs(sy - ty) < 4) {
      return `M ${sx} ${sy} L ${tx} ${ty}`;
    }
    const r = lineType === "step" ? 0 : Math.min(10, Math.abs(midX - sx), Math.abs(ty - sy) / 2);
    const sySign = ty > sy ? 1 : -1;
    if (r > 0) {
      return `M ${sx} ${sy} L ${midX - r} ${sy} Q ${midX} ${sy} ${midX} ${sy + r * sySign} L ${midX} ${ty - r * sySign} Q ${midX} ${ty} ${midX + r} ${ty} L ${tx} ${ty}`;
    }
    return `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
  } else {
    const midY = Math.round(sy + (ty - sy) / 2);
    const r = lineType === "step" ? 0 : Math.min(10, Math.abs(midY - sy), Math.abs(tx - sx) / 2);
    if (r > 0 && Math.abs(tx - sx) > r * 2) {
      const sxSign = tx > sx ? 1 : -1;
      return `M ${sx} ${sy} L ${sx} ${midY - r} Q ${sx} ${midY} ${sx + r * sxSign} ${midY} L ${tx - r * sxSign} ${midY} Q ${tx} ${midY} ${tx} ${midY + r} L ${tx} ${ty}`;
    }
    return `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
  }
}

  function flowSvg(includeFullProperties: boolean = false) {
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

    // Calculate 2D bounding box
    const pad = 60;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    stages.forEach((s) => {
      const isDecision = s.iconKey === "decision";
      const w = isDecision ? 210 : 188;
      const extraH = includeFullProperties && s.properties.length > 0 ? s.properties.length * 16 : 0;
      const h = isDecision ? 210 : 190 + extraH;
      const x = s.x ?? 0;
      const y = s.y ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    if (!Number.isFinite(minX)) {
      minX = 0; minY = 0; maxX = 960; maxY = 600;
    }

    const headerH = 90;
    const viewMinX = Math.round(minX - pad);
    const viewMinY = Math.round(minY - headerH - pad);
    const viewWidth = Math.round(Math.max(960, (maxX - minX) + pad * 2));
    const viewHeight = Math.round((maxY - minY) + headerH + pad * 2);

    // Render Edges
    const edgesSvg = edges.map((edge) => {
      const fromStage = stages.find((s) => s.id === edge.fromStageId);
      const toStage = stages.find((s) => s.id === edge.toStageId);
      if (!fromStage || !toStage) return "";

      const fromPos = getNodeHandlePos(fromStage, edge.fromHandle, false);
      const toPos = getNodeHandlePos(toStage, edge.toHandle, true);

      const pathD = getEdgeSvgPath(fromPos.x, fromPos.y, toPos.x, toPos.y, edge.lineType ?? edgeLineStyle);
      const color = edge.color ?? "#94a3b8";

      const midX = fromPos.x + (toPos.x - fromPos.x) / 2;
      const midY = fromPos.y + (toPos.y - fromPos.y) / 2;

      const labelSvg = edge.label ? [
        `<g transform="translate(${midX}, ${midY})">`,
        `<rect x="-34" y="-10" width="68" height="20" rx="4" fill="#ffffff" stroke="${color}" stroke-width="1.2"/>`,
        `<text x="0" y="3.5" text-anchor="middle" fill="#1e293b" font-size="9" font-family="Arial, sans-serif" font-weight="700">${escapeXml(edge.label)}</text>`,
        `</g>`,
      ].join("") : "";

      const arrowSvg = `<polygon points="${toPos.x - 7},${toPos.y - 4} ${toPos.x},${toPos.y} ${toPos.x - 7},${toPos.y + 4}" fill="${color}"/>`;

      return [
        `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`,
        arrowSvg,
        labelSvg,
      ].join("");
    }).join("");

    // Render Nodes
    const nodesSvg = stages.map((stage) => {
      const index = stages.findIndex((s) => s.id === stage.id);
      const isDecision = stage.iconKey === "decision";
      const x = stage.x ?? 0;
      const y = stage.y ?? 0;
      const iconUrl = `${window.location.origin}/icons/stages/${stage.iconKey}.svg`;

      if (isDecision) {
        const decisionIndex = stages.filter((s) => s.iconKey === "decision").findIndex((s) => s.id === stage.id) + 1;
        const cx = x + 105;
        const cy = y + 105;
        const innerPts = `${cx},${cy - 74} ${cx + 74},${cy} ${cx},${cy + 74} ${cx - 74},${cy}`;

        const decisionPropsRender = includeFullProperties && stage.properties.length > 0
          ? stage.properties.map((p, pi) => {
              const kind = propertyKind(p);
              let valFormatted = p.value || "—";
              if (kind === "cost" && p.value) valFormatted = `${p.currency || budgetCurrency} ${Number(p.value).toLocaleString()}`;
              else if (kind === "duration" && p.value) valFormatted = `${p.value} ${p.unit || "mins"}`;
              const line = `${escapeXml(p.name)}: ${escapeXml(valFormatted)}`;
              return `<text x="${cx}" y="${cy + 34 + pi * 13}" text-anchor="middle" fill="#475569" font-size="8" font-family="Arial, sans-serif" font-weight="600">${line.length > 24 ? line.slice(0, 22) + "…" : line}</text>`;
            }).join("")
          : (stage.properties.length > 0 ? `<rect x="${cx - 24}" y="${cy + 32}" width="48" height="14" rx="3" fill="#f1f5f9"/><text x="${cx}" y="${cy + 42}" text-anchor="middle" fill="#64748b" font-size="8" font-family="Arial, sans-serif" font-weight="700">${stage.properties.length} ${stage.properties.length === 1 ? "prop" : "props"}</text>` : "");

        return [
          `<g>`,
          `<polygon points="${innerPts}" fill="#fff7ed" stroke="${stage.color}" stroke-width="2.5"/>`,
          `<circle cx="${cx - 105}" cy="${cy}" r="4" fill="#cbd5e1" stroke="#fff" stroke-width="1.5"/>`,
          `<circle cx="${cx + 105}" cy="${cy}" r="4" fill="#cbd5e1" stroke="#fff" stroke-width="1.5"/>`,
          `<circle cx="${cx}" cy="${cy + 105}" r="4" fill="#cbd5e1" stroke="#fff" stroke-width="1.5"/>`,
          `<text x="${cx}" y="${cy - 48}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="Arial, sans-serif" font-weight="800">d${decisionIndex}</text>`,
          `<circle cx="${cx}" cy="${cy - 12}" r="17" fill="${stage.color}" fill-opacity=".12"/>`,
          `<image href="${iconUrl}" x="${cx - 12}" y="${cy - 24}" width="24" height="24"/>`,
          `<text x="${cx}" y="${cy + 22}" text-anchor="middle" fill="#1e293b" font-size="11" font-family="Arial, sans-serif" font-weight="700">${escapeXml(stage.name || "Untitled")}</text>`,
          decisionPropsRender,
          `</g>`,
        ].join("");
      }

      const extraH = includeFullProperties && stage.properties.length > 0 ? stage.properties.length * 16 + 6 : 0;
      const cardH = 190 + extraH;

      const propsRender = includeFullProperties && stage.properties.length > 0
        ? [
            `<rect x="${x + 12}" y="${y + 134}" width="164" height="${stage.properties.length * 16 + 6}" rx="5" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`,
            ...stage.properties.map((p, pi) => {
              const kind = propertyKind(p);
              let valFormatted = p.value || "—";
              if (kind === "cost" && p.value) valFormatted = `${p.currency || budgetCurrency} ${Number(p.value).toLocaleString()}`;
              else if (kind === "duration" && p.value) valFormatted = `${p.value} ${p.unit || "mins"}`;
              const line = `${escapeXml(p.name)}: ${escapeXml(valFormatted)}`;
              return `<text x="${x + 18}" y="${y + 147 + pi * 16}" fill="#334155" font-size="8.5" font-family="Arial, sans-serif" font-weight="600">${line.length > 27 ? line.slice(0, 25) + "…" : line}</text>`;
            })
          ].join("")
        : (stage.properties.length > 0 ? `<rect x="${x + 16}" y="${y + 140}" width="78" height="16" rx="4" fill="#f1f5f9"/><text x="${x + 22}" y="${y + 152}" fill="#64748b" font-size="8.5" font-family="Arial, sans-serif" font-weight="700">${stage.properties.length} ${stage.properties.length === 1 ? "property" : "properties"}</text>` : "");

      return [
        `<g>`,
        `<rect x="${x}" y="${y}" width="188" height="${cardH}" rx="12" fill="#ffffff" stroke="${stage.color}" stroke-width="1.8"/>`,
        `<rect x="${x}" y="${y}" width="188" height="4" rx="2" fill="${stage.color}"/>`,
        `<circle cx="${x}" cy="${y + 95}" r="4" fill="#cbd5e1" stroke="#fff" stroke-width="1.5"/>`,
        `<circle cx="${x + 188}" cy="${y + 95}" r="4" fill="#cbd5e1" stroke="#fff" stroke-width="1.5"/>`,
        `<text x="${x + 16}" y="${y + 24}" fill="#94a3b8" font-size="9" font-family="Arial, sans-serif" font-weight="800">${String(index + 1).padStart(2, "0")}</text>`,
        `<circle cx="${x + 32}" cy="${y + 52}" r="17" fill="${stage.color}" fill-opacity=".12"/>`,
        `<image href="${iconUrl}" x="${x + 20}" y="${y + 40}" width="24" height="24"/>`,
        `<text x="${x + 16}" y="${y + 94}" fill="#1e293b" font-size="12" font-family="Arial, sans-serif" font-weight="700">${escapeXml(stage.name || "Untitled")}</text>`,
        `<text x="${x + 16}" y="${y + 112}" fill="${stage.color}" font-size="9.5" font-family="Arial, sans-serif" font-weight="700">${escapeXml(stage.type)}</text>`,
        `<text x="${x + 16}" y="${y + 126}" fill="#64748b" font-size="9" font-family="Arial, sans-serif">${escapeXml(stage.platform)}</text>`,
        propsRender,
        `</g>`,
      ].join("");
    }).join("");

    const headerX = viewMinX + pad;
    const headerY = viewMinY + pad / 2;
    const propSummaryY = headerY + 42;

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${viewWidth}" height="${viewHeight}" viewBox="${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}">`,
      `<defs>`,
      `<pattern id="canvas-grid" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" fill="#cbd5e1"/></pattern>`,
      `</defs>`,
      `<rect x="${viewMinX}" y="${viewMinY}" width="${viewWidth}" height="${viewHeight}" fill="#f8fafc"/>`,
      `<rect x="${viewMinX}" y="${viewMinY}" width="${viewWidth}" height="${viewHeight}" fill="url(#canvas-grid)"/>`,
      `<text x="${headerX}" y="${headerY + 24}" fill="#0f172a" font-size="20" font-family="Arial, sans-serif" font-weight="700">${title}</text>`,
      `<rect x="${headerX}" y="${propSummaryY}" width="${viewWidth - pad * 2}" height="32" rx="6" fill="#ffffff" stroke="#e2e8f0"/>`,
      `<text x="${headerX + 14}" y="${propSummaryY + 20}" fill="#64748b" font-size="9.5" font-family="Arial, sans-serif">${escapeXml(propSummary)}</text>`,
      edgesSvg,
      stages.length > 0 ? nodesSvg : `<text x="${headerX}" y="${headerY + 100}" fill="#94a3b8" font-size="13" font-family="Arial, sans-serif">No stages added yet.</text>`,
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

  function flowHtml() {
    const title = escapeXml(processName.trim() || "Untitled project");
    const svgContent = flowSvg(true);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 2D Decision Canvas</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .container { max-width: 1300px; margin: 0 auto; }
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .doc-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
    .doc-meta { font-size: 12px; color: #64748b; font-weight: 600; }
    .canvas-container { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .canvas-container svg { width: 100%; height: auto; display: block; }
    @media print { body { background: #ffffff; padding: 0; } .canvas-container { border: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <h1 class="doc-title">${title}</h1>
      <span class="doc-meta">${stages.length} stages · ${totalProperties} properties</span>
    </div>
    <div class="canvas-container">
      ${svgContent}
    </div>
  </div>
</body>
</html>`;
  }

  function exportHtml() {
    const blob = new Blob([flowHtml()], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName("html");
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    setMessage("HTML document exported");
  }

  function loadExample(exampleKey: "return-request" | "forecast" = "return-request") {
    if (exampleKey === "return-request") {
      setStages(returnRequestSeedStages);
      setSelectedId(null);
      setEdges(returnRequestSeedEdges);
      setProcessName("Customer return request workflow");
      setProjectStatus("approved");
      setEnvironment("production");
      setGoLiveDate("2026-09-01");
      setProjectBudget("15000");
      setBudgetCurrency("USD");
      setProjectSla("24");
      setProjectSlaUnit("hours");
      setVersionTags(["Approved"]);
      setMessage("Customer return request example loaded");
    } else {
      setStages(seedStages);
      setSelectedId(null);
      setEdges(normalizeCanvasEdges(seedStages, seedEdges));
      setProcessName("Weekly forecast analysis AI system");
      setProjectStatus("under-review");
      setEnvironment("staging");
      setGoLiveDate("");
      setProjectBudget("50000");
      setBudgetCurrency("USD");
      setProjectSla("4");
      setProjectSlaUnit("hours");
      setVersionTags(["Proposed"]);
      setMessage("Weekly forecast analysis example loaded");
    }
  }

  function clearCanvasOnly() {
    if (!stages.length && !edges.length) return;
    if (window.confirm("Clear canvas elements (stages and connections)? Project properties will be preserved.")) {
      setStages([]);
      setEdges([]);
      setSelectedId(null);
      setSelectedEdgeId(null);
      setMessage("Canvas cleared");
    }
  }

  function clearWorkspace() {
    const hasWorkspaceContent = Boolean(processName || projectStatus !== "draft" || environment !== "development" || goLiveDate || projectBudget || projectSla || versionTags.length || stages.length || versions.length);
    if (!hasWorkspaceContent || window.confirm("Clear this entire decision workspace, including saved versions?")) {
      setStages([]);
      setEdges([]);
      setSelectedId(null);
      setSelectedEdgeId(null);
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
      setEdgeLineStyle("smoothstep");
      writeCanvasVersions([]);
      window.localStorage.removeItem(CANVAS_STORAGE_KEY);
      setShowAddMenu(false);
      setMessage("Workspace cleared");
    }
  }

  // Pan is now handled natively by React Flow.

  return (
    <AppShell>
      <div className="process-page">
        <header className="process-heading">
          <div>
            <div className="process-title-row"><input className="process-title-input" value={processName} onChange={(event) => setProcessName(event.target.value)} placeholder="Untitled decision canvas" aria-label="Decision canvas name" />{versions[0] && <span className="version-mini">v{versions[0].version}</span>}</div>
            <div className="version-tag-bar">
              <span>VERSION TAG <em>Optional</em></span>
              <div>
                {allTagOptions.map((tag) => <button key={tag} type="button" className={versionTags.includes(tag) ? "selected" : ""} onClick={() => toggleVersionTag(tag)}>{tag}</button>)}
                {!showCustomTagInput ? (
                  <button type="button" className="add-custom-tag-btn" onClick={() => setShowCustomTagInput(true)}>+ Tag</button>
                ) : (
                  <form className="custom-tag-form" onSubmit={handleAddCustomTag}>
                    <input className="custom-tag-input" value={customTagInput} onChange={(event) => setCustomTagInput(event.target.value)} placeholder="Custom tag..." autoFocus onKeyDown={(event) => { if (event.key === "Escape") { setShowCustomTagInput(false); setCustomTagInput(""); } }} />
                    <button type="submit" className="custom-tag-save">Add</button>
                    <button type="button" className="custom-tag-cancel" onClick={() => { setShowCustomTagInput(false); setCustomTagInput(""); }}>×</button>
                  </form>
                )}
              </div>
            </div>
          </div>
          <div className="process-heading-actions">
            <div className="header-status-group"><label className={`project-status-control header-project-status ${projectStatus}`}><span>PROJECT STATUS</span><SearchableSelect value={projectStatus} options={statusOptions} onChange={(value) => setProjectStatus(value as CanvasStatus)} ariaLabel="Project status" /></label></div>
            <div className="export-menu-wrap" ref={examplesMenuRef}><button className="secondary-button" onClick={() => toggleExclusiveMenu(showExamplesMenu, setShowExamplesMenu)}>Examples <span className="button-caret">⌄</span></button>{showExamplesMenu && <div className="floating-menu export-menu"><small>LOAD EXAMPLE WORKFLOW</small><button onClick={() => { loadExample("return-request"); setShowExamplesMenu(false); }}>Customer return request</button><button onClick={() => { loadExample("forecast"); setShowExamplesMenu(false); }}>Weekly forecast analysis</button></div>}</div>
            <button className="secondary-button" onClick={() => setMessage("Share link copied to clipboard")}>Share</button>
            <button className="secondary-button" onClick={saveDraft}>Save version</button>
            <input ref={importInputRef} className="hidden-file-input" type="file" accept=".decla" onChange={handleImport} /><button className="secondary-button" onClick={() => importInputRef.current?.click()}>Import file</button><button className="primary-button" onClick={saveDeclaFile}>Save to File</button><div className="export-menu-wrap" ref={exportMenuRef}><button className="secondary-button" onClick={() => toggleExclusiveMenu(showExportMenu, setShowExportMenu)}>Export <span className="button-caret">⌄</span></button>{showExportMenu && <div className="floating-menu export-menu"><small>EXPORT CANVAS</small><button onClick={exportSvg}>SVG image <span>.svg</span></button><button onClick={exportPng}>PNG image <span>.png</span></button></div>}</div><button className="clear-canvas-button" onClick={clearWorkspace} disabled={!Boolean(processName || projectStatus !== "draft" || environment !== "development" || goLiveDate || projectBudget || projectSla || versionTags.length || stages.length || versions.length)}>Clear workspace</button>
          </div>
        </header>

        <section className="project-properties-strip" aria-label="Project properties">
          <div className="project-property-metric editable-metric">
            <span>BUDGET</span>
            <div className="prop-control-group">
              <input type="number" min="0" step="1" value={projectBudget} onChange={(event) => setProjectBudget(event.target.value)} placeholder="No budget" aria-label="Project budget" className="prop-input-number" />
              <SearchableSelect value={budgetCurrency} options={currencies.map((currency) => ({ value: currency, label: currency }))} onChange={setBudgetCurrency} ariaLabel="Budget currency" className="prop-select-currency" />
            </div>
            <small><em>{budgetCurrency}</em> {totalCost.toLocaleString()}{budgetTotal > 0 ? ` · ${Math.round((totalCost / budgetTotal) * 100)}% of cap` : " · Set budget cap"}</small>
          </div>
          <div className="project-property-metric editable-metric">
            <span>SLA TARGET</span>
            <div className="prop-control-group">
              <input type="number" min="0" step="1" value={projectSla} onChange={(event) => setProjectSla(event.target.value)} placeholder="No SLA" aria-label="Project SLA" className="prop-input-number" />
              <SearchableSelect value={projectSlaUnit} options={durationUnits.map((unit) => ({ value: unit, label: unit }))} onChange={setProjectSlaUnit} ariaLabel="Project SLA unit" className="prop-select-unit" />
            </div>
            <small>{formatDuration(totalLatencyMinutes)}{slaTargetMinutes > 0 ? ` · ${Math.round((totalLatencyMinutes / slaTargetMinutes) * 100)}% ceiling` : " · end-to-end ceiling"}</small>
          </div>
          <div className="project-property-metric editable-metric">
            <span>ENVIRONMENT</span>
            <div className="prop-control-group">
              <SearchableSelect value={environment} options={environmentOptions} onChange={(value) => setEnvironment(value as CanvasEnvironment)} ariaLabel="Project environment" className={`prop-select-env ${environment}`} />
            </div>
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

        {message && <button className="process-toast" onClick={clearMessage} aria-label="Dismiss message">{message}<span>×</span></button>}

        <div className="process-layout">
          <section className="process-canvas-panel">
            <div className="canvas-toolbar">
              <div className="canvas-toolbar-row">
                <div className="canvas-toolbar-group canvas-toolbar-actions">
                  <span className="toolbar-divider" />
                  <div className="add-stage-wrap" ref={addStageMenuRef}>
                    <button className="add-stage-button" onClick={() => toggleExclusiveMenu(showAddMenu, setShowAddMenu)}>＋ Add stage</button>
                    {showAddMenu && <div className="floating-menu stage-menu">
                      <small>ADD A WORKFLOW STAGE</small>
                      {stageTypes.map((kind) => <button key={kind.key} onClick={() => addStage(kind)}><span className="menu-color" style={{ background: kind.color }} />{kind.label}<span>+</span></button>)}
                    </div>}
                  </div>
                  <div className="export-menu-wrap" ref={arrangeMenuRef}>
                    <button className="secondary-button" onClick={() => toggleExclusiveMenu(showArrangeMenu, setShowArrangeMenu)}>📐 Auto arrange <span className="button-caret">⌄</span></button>
                    {showArrangeMenu && (
                      <div className="floating-menu export-menu">
                        <small>LAYOUT & SPACING</small>
                        <button onClick={() => handleAutoArrange("TB")}>↓ Vertical flow (Top to Bottom)</button>
                        <button onClick={() => handleAutoArrange("LR")}>→ Horizontal flow (Left to Right)</button>
                        <button onClick={handleSpaciousArrange}>↔ Expand spacing (Zero overlap)</button>
                      </div>
                    )}
                  </div>
                  <div className="export-menu-wrap" ref={lineStyleMenuRef}>
                    <button className="secondary-button" onClick={() => toggleExclusiveMenu(showLineStyleMenu, setShowLineStyleMenu)}>⚡ Line style <span className="button-caret">⌄</span></button>
                    {showLineStyleMenu && (
                      <div className="floating-menu export-menu">
                        <small>EDGE ROUTING STYLE</small>
                        <button onClick={() => { setEdgeLineStyle("smoothstep"); setShowLineStyleMenu(false); setMessage("Line style set to L-shaped (Smooth)"); }}>╰─╯ L-shaped (Smooth)</button>
                        <button onClick={() => { setEdgeLineStyle("step"); setShowLineStyleMenu(false); setMessage("Line style set to L-shaped (Step)"); }}>└─┐ L-shaped (Step)</button>
                        <button onClick={() => { setEdgeLineStyle("straight"); setShowLineStyleMenu(false); setMessage("Line style set to Straight (Free flow)"); }}>─── Straight (Free flow)</button>
                        <button onClick={() => { setEdgeLineStyle("bezier"); setShowLineStyleMenu(false); setMessage("Line style set to Curved (Bezier)"); }}>∿ Curved (Bezier)</button>
                      </div>
                    )}
                  </div>
                  <button
                    className={`secondary-button${wordWrap ? " active" : ""}`}
                    onClick={() => { setWordWrap((value) => !value); setMessage(wordWrap ? "Standard stage labels" : "Word wrap enabled"); }}
                    aria-pressed={wordWrap}
                  >
                    Word Wrap
                  </button>
                  <button className="secondary-button" onClick={clearCanvasOnly} disabled={!stages.length && !edges.length}>Clear canvas</button>
                </div>
                <div className="canvas-toolbar-group canvas-tools-right">
                  <div className="canvas-search-wrap">
                    <span className="canvas-search-icon" aria-hidden="true">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </span>
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="canvas-search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search nodes (e.g. intake, LLM)..."
                      aria-label="Search and highlight canvas nodes"
                    />
                    {searchQuery ? (
                      <div className="canvas-search-badge-wrap">
                        <span className={`search-match-count ${searchMatchSet.size > 0 ? "has-matches" : "no-matches"}`}>
                          {searchMatchSet.size} {searchMatchSet.size === 1 ? "match" : "matches"}
                        </span>
                        <button
                          className="canvas-search-clear"
                          onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                          title="Clear search (Esc)"
                          aria-label="Clear node search"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <kbd className="canvas-search-kbd">⌘F</kbd>
                    )}
                  </div>
                </div>
              </div>
              <div className="canvas-toolbar-stats">
                <span className="canvas-stat"><strong>{stages.length}</strong> stages</span>
                <span className="canvas-stat"><strong>{edges.length}</strong> connections</span>
                <span className="canvas-stat"><strong>{totalProperties}</strong> properties</span>
              </div>
            </div>

            <div className="canvas-viewport rf-viewport">
              {stages.length === 0 ? (
                <div className="blank-canvas-state">
                  <span className="blank-canvas-mark">＋</span>
                  <span className="process-eyebrow">BLANK PROCESS CANVAS</span>
                  <h2>Start mapping your process</h2>
                  <p>Add a stage to begin building your decision workflow.</p>
                  <div>
                    <button className="primary-button" onClick={() => { closeFloatingMenus(); setShowAddMenu(true); }}>＋ Add first stage</button>
                  </div>
                </div>
              ) : (
                <FlowCanvas
                  stages={stages}
                  edges={edges}
                  selectedStageId={selectedId}
                  selectedEdgeId={selectedEdgeId}
                  searchQuery={searchQuery}
                  searchMatchIds={searchMatchSet}
                  edgeLineStyle={edgeLineStyle}
                  wordWrap={wordWrap}
                  onSelectStage={(id) => { setSelectedId(id); setSelectedEdgeId(null); }}
                  onSelectEdge={(id) => { setSelectedEdgeId(id); setSelectedId(null); }}
                  onStagePositionsChange={handleStagePositionsChange}
                  onEdgeCreated={handleEdgeCreated}
                  onEdgeDeleted={handleEdgeDeleted}
                  onAddStageRequest={() => { closeFloatingMenus(); setShowAddMenu(true); }}
                />
              )}
            </div>

            <div className="canvas-footer">
              <span><i className="legend-dot source" /> Input</span><span><i className="legend-dot transform" /> Transform</span><span><i className="legend-dot human-action" /> Human Action</span><span><i className="legend-dot business-rule" /> Business Rule</span><span><i className="legend-dot llm" /> LLM</span><span><i className="legend-dot user-interface" /> User Interface</span><span><i className="legend-dot decision" /> Decision</span><span><i className="legend-dot output" /> Automation</span>
              <span className="canvas-footer-note">Changes are saved in this browser</span>
            </div>
          </section>

          <aside className="inspector-panel">
            {selectedStage ? (
              <>
                <div className="inspector-header"><div><span className="process-eyebrow">STAGE PROPERTIES</span><h2>Edit stage</h2></div><button className="icon-button" onClick={removeSelected} aria-label="Delete selected stage">⌫</button></div>
                <div className="inspector-stage-banner" style={{ "--node-accent": selectedStage.color } as CSSProperties}><span className="inspector-icon"><StageIcon stage={{ label: selectedStage.name, platform: selectedStage.platform, stage_type_key: selectedStage.iconKey, category: selectedStage.type }} decorative={false} /></span><div><strong>{selectedStage.name}</strong><small>{selectedStage.iconKey === "decision" ? `Decision d${stages.filter((s) => s.iconKey === "decision").findIndex((s) => s.id === selectedStage.id) + 1} · ` : ""}Stage {String(stages.findIndex((stage) => stage.id === selectedStage.id) + 1).padStart(2, "0")} of {stages.length}</small></div></div>
                <div className="inspector-form">
                  <label><span>Name</span><input value={selectedStage.name} onChange={(event) => updateStage({ name: event.target.value })} placeholder="Name this stage" /></label>
                  <label><span>Type</span><SearchableSelect value={selectedStage.iconKey} options={stageTypes.map((type) => ({ value: type.key, label: type.label }))} onChange={(value) => changeType(value as StageKind)} ariaLabel="Stage type" /></label>
                  <label><span>Platform</span><SearchableSelect value={selectedStage.platform} options={platformsForStage(selectedStage.iconKey as StageKind).map((platform) => ({ value: platform, label: platform }))} onChange={(value) => updateStage({ platform: value })} ariaLabel="Stage platform" allowCustom /></label>
                </div>
                {stageConfigNotes[selectedStage.iconKey as StageKind] && (
                  <div className="stage-config-note">
                    <strong>{stageConfigNotes[selectedStage.iconKey as StageKind]!.title}</strong>
                    <span>{stageConfigNotes[selectedStage.iconKey as StageKind]!.description}</span>
                  </div>
                )}
                <div className="properties-section"><div className="properties-heading"><div><span className="process-eyebrow">CUSTOM DATA</span><strong>Properties</strong></div><div className="property-add-wrap" ref={propertyMenuRef}><button className="add-property-button" onClick={() => toggleExclusiveMenu(showPropertyMenu, setShowPropertyMenu)}>＋ Add property</button>{showPropertyMenu && <div className="floating-menu property-menu"><small>CHOOSE A PROPERTY</small>{universalPropertyPresets.filter((preset) => !selectedStage.properties.some((property) => propertyKind(property) === preset.kind)).map((preset) => <button key={preset.kind} onClick={() => addProperty(preset)}>{preset.label}<span>+</span></button>)}<button onClick={() => addProperty()}><em>＋</em> Custom property</button></div>}</div></div>
                  <p className="properties-help">Add the metrics your team uses to describe this stage.</p>
                  <div className="property-list">
                    {selectedStage.properties.map((property) => (
                      <StagePropertyRow key={property.id} property={property} onUpdate={updateProperty} onRemove={removeProperty} />
                    ))}
                    {selectedStage.properties.length === 0 && <div className="properties-empty"><span>⌁</span><p>No custom properties yet.<br />Add duration, cost, rows, or anything useful.</p></div>}
                  </div>
                </div>
                {stagePropertyPresets[selectedStage.iconKey as StageKind]?.length > 0 && (
                  <div className="stage-property-quick-add">
                    <span>{stageQuickAddLabel(selectedStage.iconKey as StageKind)}</span>
                    <div>
                      {stagePropertyPresets[selectedStage.iconKey as StageKind]
                        .filter((preset) => !selectedStage.properties.some((property) => propertyKind(property) === preset.kind))
                        .map((preset) => (
                          <button key={preset.kind} onClick={() => addProperty(preset)}>+ {preset.label}</button>
                        ))}
                    </div>
                  </div>
                )}
                <label className="notes-field"><span>Notes <em>Optional</em></span><textarea placeholder="Add context for your team..." rows={3} /></label>
              </>
            ) : selectedEdge ? (
              <>
                <div className="inspector-header">
                  <div><span className="process-eyebrow">CONNECTION</span><h2>Edit edge</h2></div>
                  <button className="icon-button" onClick={() => handleEdgeDeleted(selectedEdge.id)} aria-label="Delete selected edge">⌫</button>
                </div>
                <div className="edge-inspector-banner">
                  <span className="edge-inspector-icon">→</span>
                  <div>
                    <strong>{stages.find((s) => s.id === selectedEdge.fromStageId)?.name ?? "Unknown"}</strong>
                    <small>→ {stages.find((s) => s.id === selectedEdge.toStageId)?.name ?? "Unknown"}</small>
                  </div>
                </div>
                <div className="inspector-form edge-inspector-form">
                  <label>
                    <span>Label <em style={{ fontStyle: "normal", color: "var(--muted)", fontWeight: 400 }}>Optional</em></span>
                    <input value={selectedEdge.label ?? ""} onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value })} placeholder="e.g. Yes, No, Approved…" aria-label="Edge label" />
                  </label>
                  <label>
                    <span>Line style</span>
                    <SearchableSelect
                      value={selectedEdge.lineType ?? edgeLineStyle}
                      options={[
                        { value: "smoothstep", label: "L-shaped (Smooth)" },
                        { value: "step", label: "L-shaped (Step)" },
                        { value: "straight", label: "Straight (Free flow)" },
                        { value: "bezier", label: "Curved (Bezier)" },
                      ]}
                      onChange={(value) => updateEdge(selectedEdge.id, { lineType: value as CanvasEdgeLineStyle })}
                      ariaLabel="Edge line style"
                    />
                  </label>
                  <label>
                    <span>Path colour</span>
                    <div className="edge-color-swatches">
                      {([
                        { label: "Default", value: undefined },
                        { label: "Green", value: "#16a34a" },
                        { label: "Red", value: "#dc2626" },
                        { label: "Orange", value: "#f36a10" },
                        { label: "Blue", value: "#2563eb" },
                        { label: "Purple", value: "#7c3aed" },
                      ] as { label: string; value: string | undefined }[]).map(({ label, value }) => (
                        <button key={label} className={`edge-swatch${(selectedEdge.color ?? undefined) === value ? " selected" : ""}`} style={{ background: value ?? "var(--edge-default)" }} onClick={() => updateEdge(selectedEdge.id, { color: value })} aria-label={label} title={label} />
                      ))}
                    </div>
                  </label>
                  <label>
                    <span>Condition <em style={{ fontStyle: "normal", color: "var(--muted)", fontWeight: 400 }}>Optional</em></span>
                    <input value={selectedEdge.condition ?? ""} onChange={(e) => updateEdge(selectedEdge.id, { condition: e.target.value })} placeholder="e.g. score &gt; 0.9" aria-label="Edge condition" />
                  </label>
                </div>
                <p className="properties-help" style={{ marginTop: 14 }}>
                  Add a label to annotate the path (e.g. &quot;Yes&quot; / &quot;No&quot;).<br />
                  Use a colour to visually distinguish branching outcomes.
                </p>
              </>
            ) : (
              <div className="inspector-empty">
                <span>◎</span>
                <h2>Select a stage or edge</h2>
                <p>Click a stage to edit its properties, or click a connection to label and colour it.</p>
                <p className="inspector-empty-hint">Drag from a stage handle to create a new connection.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

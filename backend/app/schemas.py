from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DefinitionVersion(ApiModel):
    id: UUID
    version_number: int
    json_schema: dict[str, Any] = Field(alias="schema")


class StageTypeOut(ApiModel):
    id: UUID
    key: str
    name: str
    category: str
    icon: str
    color: str
    enabled: bool
    version: DefinitionVersion


class StageTypeCreate(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    icon: str = Field(default="STG", max_length=20)
    color: str = Field(default="#4f46e5", pattern=r"^#[0-9a-fA-F]{6}$")
    property_schema: dict[str, Any] = Field(default_factory=dict)


class LogTypeOut(ApiModel):
    id: UUID
    key: str
    name: str
    description: str
    enabled: bool
    version: DefinitionVersion


class LogTypeCreate(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    field_schema: dict[str, Any] = Field(default_factory=dict)


class MeasureDefinitionOut(ApiModel):
    id: UUID
    key: str
    name: str
    description: str
    value_type: str
    unit: str
    aggregation: str
    improvement_direction: str
    display_order: int
    enabled: bool


class MeasureDefinitionCreate(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    value_type: Literal["number", "duration", "currency", "percentage", "rating"] = "number"
    unit: str = "count"
    aggregation: Literal["sum", "average", "maximum", "count", "distinct_count"] = "sum"
    improvement_direction: Literal[
        "lower_is_better", "higher_is_better", "target_is_better", "neutral"
    ] = "lower_is_better"
    display_order: int = 0


class StageInput(BaseModel):
    id: UUID | None = None
    logical_key: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9_-]*$")
    stage_type_version_id: UUID
    position: int = Field(ge=0)
    label: str = Field(min_length=1, max_length=160)
    platform: str = Field(default="", max_length=160)
    properties: dict[str, Any] = Field(default_factory=dict)
    note: str = ""


class StageOut(StageInput):
    id: UUID
    stage_type_key: str
    stage_type_name: str
    category: str
    icon: str
    color: str


class MeasureValueInput(BaseModel):
    measure_definition_id: UUID
    stage_logical_key: str | None = None
    numeric_value: Decimal | None = None
    text_value: str | None = None
    source: Literal["calculated", "estimated", "observed", "manually_entered"] = "estimated"
    explanation: str = ""

    @model_validator(mode="after")
    def require_value(self):
        if self.numeric_value is None and self.text_value is None:
            raise ValueError("numeric_value or text_value is required")
        return self


class MeasureValueOut(ApiModel):
    id: UUID
    measure_definition_id: UUID
    measure_key: str
    measure_name: str
    unit: str
    value_type: str
    improvement_direction: str
    stage_id: UUID | None
    numeric_value: Decimal | None
    text_value: str | None
    source: str
    explanation: str


class VersionOut(ApiModel):
    id: UUID
    dataflow_id: UUID
    version_number: int
    version_name: str
    change_summary: str
    business_goal: str
    latency_target_minutes: Decimal | None
    monthly_budget: Decimal | None
    status: str
    created_from_version_id: UUID | None
    created_at: datetime
    published_at: datetime | None
    tags: list[str] = Field(default_factory=list)
    stages: list[StageOut] = Field(default_factory=list)
    measures: list[MeasureValueOut] = Field(default_factory=list)


class VersionUpdate(BaseModel):
    version_name: str | None = Field(default=None, min_length=1, max_length=160)
    change_summary: str | None = None
    business_goal: str | None = None
    latency_target_minutes: Decimal | None = Field(default=None, ge=0)
    monthly_budget: Decimal | None = Field(default=None, ge=0)
    stages: list[StageInput] | None = None
    measures: list[MeasureValueInput] | None = None


class DataflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    business_goal: str = ""
    latency_target_minutes: Decimal | None = Field(default=None, ge=0)
    monthly_budget: Decimal | None = Field(default=None, ge=0)


class DataflowSummary(ApiModel):
    id: UUID
    name: str
    description: str
    created_at: datetime
    current_version_id: UUID | None = None
    current_version_number: int | None = None
    proposed_version_id: UUID | None = None
    proposed_version_number: int | None = None


class CloneVersionRequest(BaseModel):
    from_tag: str = "current"
    version_name: str | None = None
    change_summary: str = ""
    assign_tag: str | None = "proposed"


class TagAssignment(BaseModel):
    version_id: UUID


class ComparisonMeasure(BaseModel):
    definition_id: UUID
    key: str
    name: str
    unit: str
    value_type: str
    direction: str
    current_value: Decimal | None
    proposed_value: Decimal | None
    absolute_change: Decimal | None
    percentage_improvement: Decimal | None
    assessment: Literal["better", "worse", "unchanged", "not_comparable"]
    current_text: str | None = None
    proposed_text: str | None = None


class StageDifference(BaseModel):
    logical_key: str
    current_stage: StageOut | None
    proposed_stage: StageOut | None
    change: Literal["added", "removed", "modified", "unchanged"]


class ComparisonOut(BaseModel):
    dataflow_id: UUID
    current: VersionOut
    proposed: VersionOut
    measures: list[ComparisonMeasure]
    stage_differences: list[StageDifference]


class PipelineRunCreate(BaseModel):
    dataflow_version_id: UUID
    external_id: str | None = None
    business_event_at: datetime | None = None
    started_at: datetime


class PipelineRunOut(ApiModel):
    id: UUID
    dataflow_version_id: UUID
    external_id: str | None
    status: str
    business_event_at: datetime | None
    started_at: datetime
    completed_at: datetime | None


class LogEventCreate(BaseModel):
    pipeline_run_id: UUID
    stage_id: UUID | None = None
    log_type_key: str
    idempotency_key: str = Field(min_length=1, max_length=180)
    occurred_at: datetime
    severity: Literal["debug", "info", "warning", "error", "critical"] = "info"
    message: str = ""
    source: str = "api"
    correlation_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class LogEventOut(ApiModel):
    id: UUID
    pipeline_run_id: UUID
    stage_run_id: UUID | None
    log_type_version_id: UUID
    idempotency_key: str
    occurred_at: datetime
    severity: str
    message: str
    source: str
    correlation_id: str | None
    payload: dict[str, Any]

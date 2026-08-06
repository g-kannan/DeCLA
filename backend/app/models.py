from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Dataflow(TimestampMixin, Base):
    __tablename__ = "dataflows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)


class DataflowVersion(Base):
    __tablename__ = "dataflow_versions"
    __table_args__ = (
        UniqueConstraint("dataflow_id", "version_number", name="uq_dataflow_version_number"),
        CheckConstraint("version_number > 0", name="ck_version_number_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataflow_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dataflows.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    version_name: Mapped[str] = mapped_column(String(160), nullable=False)
    change_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    business_goal: Mapped[str] = mapped_column(Text, default="", nullable=False)
    latency_target_minutes: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    monthly_budget: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True, nullable=False)
    created_from_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("dataflow_versions.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DataflowVersionTag(Base):
    __tablename__ = "dataflow_version_tags"
    __table_args__ = (
        Index(
            "uq_active_dataflow_tag",
            "dataflow_id",
            "tag",
            unique=True,
            postgresql_where=text("valid_to IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataflow_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dataflows.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dataflow_versions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tag: Mapped[str] = mapped_column(String(40), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StageType(TimestampMixin, Base):
    __tablename__ = "stage_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    icon: Mapped[str] = mapped_column(String(20), default="STG", nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#4f46e5", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StageTypeVersion(Base):
    __tablename__ = "stage_type_versions"
    __table_args__ = (
        UniqueConstraint("stage_type_id", "version_number", name="uq_stage_type_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stage_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stage_types.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    property_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="published", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Stage(Base):
    __tablename__ = "stages"
    __table_args__ = (
        UniqueConstraint("dataflow_version_id", "logical_key", name="uq_version_stage_key"),
        UniqueConstraint("dataflow_version_id", "position", name="uq_version_stage_position"),
        CheckConstraint("position >= 0", name="ck_stage_position_nonnegative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataflow_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dataflow_versions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    logical_key: Mapped[str] = mapped_column(String(100), nullable=False)
    stage_type_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stage_type_versions.id", ondelete="RESTRICT"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    platform: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)


class StageConnection(Base):
    __tablename__ = "stage_connections"
    __table_args__ = (
        UniqueConstraint(
            "dataflow_version_id", "from_stage_id", "to_stage_id", name="uq_stage_connection"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataflow_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dataflow_versions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    from_stage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stages.id", ondelete="CASCADE"), nullable=False
    )
    to_stage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stages.id", ondelete="CASCADE"), nullable=False
    )


class MeasureDefinition(TimestampMixin, Base):
    __tablename__ = "measure_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    value_type: Mapped[str] = mapped_column(String(30), default="number", nullable=False)
    unit: Mapped[str] = mapped_column(String(40), default="count", nullable=False)
    aggregation: Mapped[str] = mapped_column(String(30), default="sum", nullable=False)
    improvement_direction: Mapped[str] = mapped_column(
        String(30), default="lower_is_better", nullable=False
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class VersionMeasureValue(Base):
    __tablename__ = "version_measure_values"
    __table_args__ = (
        Index(
            "uq_flow_measure_value",
            "dataflow_version_id",
            "measure_definition_id",
            unique=True,
            postgresql_where=text("stage_id IS NULL"),
        ),
        Index(
            "uq_stage_measure_value",
            "dataflow_version_id",
            "stage_id",
            "measure_definition_id",
            unique=True,
            postgresql_where=text("stage_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataflow_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dataflow_versions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    stage_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("stages.id", ondelete="CASCADE"), index=True
    )
    measure_definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("measure_definitions.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    text_value: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(30), default="estimated", nullable=False)
    explanation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LogType(TimestampMixin, Base):
    __tablename__ = "log_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class LogTypeVersion(Base):
    __tablename__ = "log_type_versions"
    __table_args__ = (
        UniqueConstraint("log_type_id", "version_number", name="uq_log_type_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    log_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("log_types.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    field_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="published", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataflow_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dataflow_versions.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    external_id: Mapped[str | None] = mapped_column(String(160), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="running", index=True, nullable=False)
    business_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class StageRun(Base):
    __tablename__ = "stage_runs"
    __table_args__ = (UniqueConstraint("pipeline_run_id", "stage_id", name="uq_run_stage"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stages.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="running", index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LogEvent(Base):
    __tablename__ = "log_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    stage_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("stage_runs.id", ondelete="CASCADE"), index=True
    )
    log_type_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("log_type_versions.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    idempotency_key: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    severity: Mapped[str] = mapped_column(String(20), default="info", index=True, nullable=False)
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    source: Mapped[str] = mapped_column(String(120), default="api", nullable=False)
    correlation_id: Mapped[str | None] = mapped_column(String(180), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

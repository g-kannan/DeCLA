import asyncio
import uuid
from decimal import Decimal

from sqlalchemy import select

from app.database import get_session_factory
from app.models import (
    Dataflow,
    DataflowVersion,
    DataflowVersionTag,
    LogType,
    LogTypeVersion,
    MeasureDefinition,
    Stage,
    StageConnection,
    StageType,
    StageTypeVersion,
    VersionMeasureValue,
)

STAGE_TYPES = [
    ("source", "Business event", "source", "SRC", "#2563eb", {}),
    (
        "human_action",
        "Human Action",
        "human_action",
        "HUM",
        "#7c3aed",
        {
            "type": "object",
            "properties": {
                "assignee": {"type": "string"},
                "instructions": {"type": "string"},
            },
            "additionalProperties": True,
        },
    ),
    (
        "business_rule",
        "Business Rule",
        "business_rule",
        "RUL",
        "#0891b2",
        {
            "type": "object",
            "properties": {
                "expression": {"type": "string"},
                "outcome": {"type": "string"},
            },
            "additionalProperties": True,
        },
    ),
    (
        "decision",
        "Decision",
        "decision",
        "DSN",
        "#f36a10",
        {
            "type": "object",
            "properties": {
                "criteria": {"type": "string"},
                "confidence_threshold": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                },
            },
            "additionalProperties": True,
        },
    ),
    (
        "llm",
        "LLM",
        "llm",
        "LLM",
        "#db2777",
        {
            "type": "object",
            "properties": {
                "provider": {"type": "string"},
                "model": {"type": "string"},
                "prompt": {"type": "string"},
                "temperature": {"type": "number", "minimum": 0, "maximum": 2},
            },
            "additionalProperties": True,
        },
    ),
    (
        "transform",
        "Transformation",
        "transform",
        "TRN",
        "#059669",
        {
            "type": "object",
            "properties": {"engine": {"type": "string"}},
            "additionalProperties": True,
        },
    ),
    (
        "store",
        "Storage",
        "store",
        "STR",
        "#7c3aed",
        {
            "type": "object",
            "properties": {"format": {"type": "string"}},
            "additionalProperties": True,
        },
    ),
    (
        "load",
        "Warehouse load",
        "ingest",
        "LOD",
        "#0284c7",
        {
            "type": "object",
            "properties": {"mode": {"enum": ["full", "incremental", "streaming"]}},
            "additionalProperties": True,
        },
    ),
    ("serve", "Serving layer", "serve", "SRV", "#be185d", {}),
    ("consume", "Consumption", "consume", "USE", "#475569", {}),
]

MEASURES = [
    ("transformations", "Transformations", "count", "lower_is_better"),
    ("storage_copies", "Storage copies", "count", "lower_is_better"),
    ("orchestrated_jobs", "Orchestrated jobs", "count", "lower_is_better"),
    ("technologies_involved", "Technologies involved", "count", "lower_is_better"),
    ("failure_points", "Failure points", "count", "lower_is_better"),
    ("data_freshness", "Data freshness", "minutes", "lower_is_better"),
    ("time_to_recovery", "Time to recovery", "minutes", "lower_is_better"),
    ("operational_cost", "Operational cost", "USD/month", "lower_is_better"),
    ("maintenance_overhead", "Maintenance overhead", "hours/month", "lower_is_better"),
]

CURRENT_VALUES = [2, 2, 3, 3, 5, 35, 90, 8000, 48]
PROPOSED_VALUES = [1, 1, 1, 3, 2, 12, 20, 5200, 16]


async def seed() -> None:
    async with get_session_factory()() as session:
        type_versions: dict[str, StageTypeVersion] = {}
        for key, name, category, icon, color, schema in STAGE_TYPES:
            stage_type = await session.scalar(select(StageType).where(StageType.key == key))
            if stage_type is None:
                stage_type = StageType(
                    key=key, name=name, category=category, icon=icon, color=color
                )
                session.add(stage_type)
                await session.flush()
                version = StageTypeVersion(
                    stage_type_id=stage_type.id,
                    version_number=1,
                    property_schema=schema,
                    status="published",
                )
                session.add(version)
                await session.flush()
            else:
                version = await session.scalar(
                    select(StageTypeVersion)
                    .where(StageTypeVersion.stage_type_id == stage_type.id)
                    .order_by(StageTypeVersion.version_number.desc())
                )
                assert version is not None
            type_versions[key] = version

        measure_defs: list[MeasureDefinition] = []
        for order, (key, name, unit, direction) in enumerate(MEASURES):
            definition = await session.scalar(
                select(MeasureDefinition).where(MeasureDefinition.key == key)
            )
            if definition is None:
                definition = MeasureDefinition(
                    key=key,
                    name=name,
                    unit=unit,
                    value_type="currency"
                    if key == "operational_cost"
                    else "duration"
                    if unit in {"minutes", "hours/month"}
                    else "number",
                    aggregation="sum",
                    improvement_direction=direction,
                    display_order=order,
                )
                session.add(definition)
                await session.flush()
            measure_defs.append(definition)

        log_specs = [
            ("stage_started", "Stage started", {}),
            (
                "stage_completed",
                "Stage completed",
                {
                    "type": "object",
                    "properties": {
                        "duration_ms": {"type": "number", "minimum": 0},
                        "rows_processed": {"type": "integer", "minimum": 0},
                        "cost": {"type": "number", "minimum": 0},
                    },
                    "required": ["duration_ms"],
                    "additionalProperties": True,
                },
            ),
            (
                "stage_failed",
                "Stage failed",
                {
                    "type": "object",
                    "properties": {
                        "error_code": {"type": "string"},
                        "retryable": {"type": "boolean"},
                    },
                    "required": ["error_code"],
                    "additionalProperties": True,
                },
            ),
        ]
        for key, name, field_schema in log_specs:
            if await session.scalar(select(LogType.id).where(LogType.key == key)):
                continue
            log_type = LogType(key=key, name=name)
            session.add(log_type)
            await session.flush()
            session.add(
                LogTypeVersion(
                    log_type_id=log_type.id,
                    version_number=1,
                    field_schema=field_schema,
                    status="published",
                )
            )

        if await session.scalar(
            select(Dataflow.id).where(Dataflow.name == "Executive Revenue Pulse")
        ):
            await session.commit()
            return

        dataflow = Dataflow(
            name="Executive Revenue Pulse",
            description="Current and proposed source-to-decision architecture.",
        )
        session.add(dataflow)
        await session.flush()
        current = DataflowVersion(
            dataflow_id=dataflow.id,
            version_number=1,
            version_name="Current architecture",
            change_summary="Existing Databricks, Snowflake, and SnowSQL path.",
            business_goal="Reduce the time from a revenue event to an executive decision.",
            latency_target_minutes=Decimal("15"),
            monthly_budget=Decimal("6000"),
            status="published",
        )
        proposed = DataflowVersion(
            dataflow_id=dataflow.id,
            version_number=2,
            version_name="Proposed Iceberg architecture",
            change_summary="Remove duplicate load and business-logic layers.",
            business_goal=current.business_goal,
            latency_target_minutes=current.latency_target_minutes,
            monthly_budget=current.monthly_budget,
            status="draft",
            created_from_version_id=None,
        )
        session.add_all([current, proposed])
        await session.flush()
        proposed.created_from_version_id = current.id
        session.add_all(
            [
                DataflowVersionTag(dataflow_id=dataflow.id, version_id=current.id, tag="current"),
                DataflowVersionTag(dataflow_id=dataflow.id, version_id=proposed.id, tag="proposed"),
            ]
        )

        current_specs = [
            ("business_event", "source", "Business event", "Source system", {}),
            (
                "spark_transform",
                "transform",
                "Spark transformation",
                "Databricks",
                {"engine": "Spark"},
            ),
            ("snowflake_load", "load", "Write to Snowflake", "Snowflake", {"mode": "incremental"}),
            ("snowsql", "transform", "SnowSQL scripts", "SnowSQL", {"engine": "SnowSQL"}),
            ("consumption", "consume", "Executive dashboard", "MicroStrategy", {}),
        ]
        proposed_specs = [
            ("business_event", "source", "Business event", "Source system", {}),
            (
                "spark_transform",
                "transform",
                "Spark transformation",
                "Databricks",
                {"engine": "Spark"},
            ),
            (
                "iceberg_catalog",
                "store",
                "Iceberg catalog",
                "Apache Iceberg",
                {"format": "Iceberg"},
            ),
            ("consumption", "consume", "Direct dashboard consumption", "MicroStrategy", {}),
        ]

        async def add_stages(version: DataflowVersion, specs: list[tuple]) -> None:
            stages: list[Stage] = []
            for position, (logical_key, type_key, label, platform, properties) in enumerate(specs):
                stage = Stage(
                    id=uuid.uuid4(),
                    dataflow_version_id=version.id,
                    logical_key=logical_key,
                    stage_type_version_id=type_versions[type_key].id,
                    position=position,
                    label=label,
                    platform=platform,
                    properties=properties,
                )
                session.add(stage)
                stages.append(stage)
            for left, right in zip(stages, stages[1:], strict=False):
                session.add(
                    StageConnection(
                        dataflow_version_id=version.id,
                        from_stage_id=left.id,
                        to_stage_id=right.id,
                    )
                )

        await add_stages(current, current_specs)
        await add_stages(proposed, proposed_specs)
        for definition, before, after in zip(
            measure_defs, CURRENT_VALUES, PROPOSED_VALUES, strict=True
        ):
            session.add_all(
                [
                    VersionMeasureValue(
                        dataflow_version_id=current.id,
                        measure_definition_id=definition.id,
                        numeric_value=Decimal(before),
                        source="observed",
                    ),
                    VersionMeasureValue(
                        dataflow_version_id=proposed.id,
                        measure_definition_id=definition.id,
                        numeric_value=Decimal(after),
                        source="estimated",
                    ),
                ]
            )
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())

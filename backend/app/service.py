from __future__ import annotations

import uuid

from fastapi import HTTPException
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError, ValidationError
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.comparison import compare_numeric
from app.models import (
    Dataflow,
    DataflowVersion,
    DataflowVersionTag,
    MeasureDefinition,
    Stage,
    StageConnection,
    StageType,
    StageTypeVersion,
    VersionMeasureValue,
)
from app.schemas import (
    ComparisonMeasure,
    ComparisonOut,
    DataflowSummary,
    MeasureValueOut,
    StageDifference,
    StageOut,
    VersionOut,
    VersionUpdate,
)


async def active_version(
    session: AsyncSession, dataflow_id: uuid.UUID, tag: str
) -> DataflowVersion:
    version = await session.scalar(
        select(DataflowVersion)
        .join(DataflowVersionTag, DataflowVersionTag.version_id == DataflowVersion.id)
        .where(
            DataflowVersionTag.dataflow_id == dataflow_id,
            DataflowVersionTag.tag == tag,
            DataflowVersionTag.valid_to.is_(None),
        )
    )
    if version is None:
        raise HTTPException(status_code=404, detail=f"No active '{tag}' version")
    return version


async def assign_tag(
    session: AsyncSession, dataflow_id: uuid.UUID, tag: str, version_id: uuid.UUID
) -> None:
    version = await session.get(DataflowVersion, version_id)
    if version is None or version.dataflow_id != dataflow_id:
        raise HTTPException(status_code=404, detail="Version does not belong to this dataflow")
    await session.execute(
        update(DataflowVersionTag)
        .where(
            DataflowVersionTag.dataflow_id == dataflow_id,
            DataflowVersionTag.tag == tag,
            DataflowVersionTag.valid_to.is_(None),
        )
        .values(valid_to=func.now())
    )
    session.add(DataflowVersionTag(dataflow_id=dataflow_id, version_id=version_id, tag=tag))
    await session.flush()


async def serialize_version(session: AsyncSession, version: DataflowVersion) -> VersionOut:
    tags = list(
        (
            await session.scalars(
                select(DataflowVersionTag.tag).where(
                    DataflowVersionTag.version_id == version.id,
                    DataflowVersionTag.valid_to.is_(None),
                )
            )
        ).all()
    )
    stage_rows = (
        await session.execute(
            select(Stage, StageType)
            .join(StageTypeVersion, StageTypeVersion.id == Stage.stage_type_version_id)
            .join(StageType, StageType.id == StageTypeVersion.stage_type_id)
            .where(Stage.dataflow_version_id == version.id)
            .order_by(Stage.position)
        )
    ).all()
    stages = [
        StageOut(
            id=stage.id,
            logical_key=stage.logical_key,
            stage_type_version_id=stage.stage_type_version_id,
            position=stage.position,
            label=stage.label,
            platform=stage.platform,
            properties=stage.properties,
            note=stage.note,
            stage_type_key=stage_type.key,
            stage_type_name=stage_type.name,
            category=stage_type.category,
            icon=stage_type.icon,
            color=stage_type.color,
        )
        for stage, stage_type in stage_rows
    ]
    measure_rows = (
        await session.execute(
            select(VersionMeasureValue, MeasureDefinition)
            .join(
                MeasureDefinition,
                MeasureDefinition.id == VersionMeasureValue.measure_definition_id,
            )
            .where(VersionMeasureValue.dataflow_version_id == version.id)
            .order_by(MeasureDefinition.display_order, MeasureDefinition.name)
        )
    ).all()
    measures = [
        MeasureValueOut(
            id=value.id,
            measure_definition_id=definition.id,
            measure_key=definition.key,
            measure_name=definition.name,
            unit=definition.unit,
            value_type=definition.value_type,
            improvement_direction=definition.improvement_direction,
            stage_id=value.stage_id,
            numeric_value=value.numeric_value,
            text_value=value.text_value,
            source=value.source,
            explanation=value.explanation,
        )
        for value, definition in measure_rows
    ]
    return VersionOut(
        id=version.id,
        dataflow_id=version.dataflow_id,
        version_number=version.version_number,
        version_name=version.version_name,
        change_summary=version.change_summary,
        business_goal=version.business_goal,
        latency_target_minutes=version.latency_target_minutes,
        monthly_budget=version.monthly_budget,
        status=version.status,
        created_from_version_id=version.created_from_version_id,
        created_at=version.created_at,
        published_at=version.published_at,
        tags=tags,
        stages=stages,
        measures=measures,
    )


async def list_dataflow_summaries(session: AsyncSession) -> list[DataflowSummary]:
    dataflows = list((await session.scalars(select(Dataflow).order_by(Dataflow.name))).all())
    result: list[DataflowSummary] = []
    for dataflow in dataflows:
        active = (
            await session.execute(
                select(DataflowVersionTag.tag, DataflowVersion.id, DataflowVersion.version_number)
                .join(DataflowVersion, DataflowVersion.id == DataflowVersionTag.version_id)
                .where(
                    DataflowVersionTag.dataflow_id == dataflow.id,
                    DataflowVersionTag.valid_to.is_(None),
                )
            )
        ).all()
        versions = {tag: (version_id, number) for tag, version_id, number in active}
        result.append(
            DataflowSummary(
                id=dataflow.id,
                name=dataflow.name,
                description=dataflow.description,
                created_at=dataflow.created_at,
                current_version_id=versions.get("current", (None, None))[0],
                current_version_number=versions.get("current", (None, None))[1],
                proposed_version_id=versions.get("proposed", (None, None))[0],
                proposed_version_number=versions.get("proposed", (None, None))[1],
            )
        )
    return result


def validate_json_schema(schema: dict, value: dict, label: str) -> None:
    if not schema:
        return
    try:
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(value)
    except (SchemaError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid {label}: {exc.message}") from exc


async def replace_version_content(
    session: AsyncSession, version: DataflowVersion, payload: VersionUpdate
) -> None:
    if version.status != "draft":
        raise HTTPException(
            status_code=409, detail="Published versions are immutable; clone a draft"
        )

    changes = payload.model_dump(exclude_unset=True, exclude={"stages", "measures"})
    for field, value in changes.items():
        setattr(version, field, value)

    stage_by_key: dict[str, Stage] = {}
    if payload.stages is not None:
        positions = [item.position for item in payload.stages]
        logical_keys = [item.logical_key for item in payload.stages]
        if len(set(positions)) != len(positions) or len(set(logical_keys)) != len(logical_keys):
            raise HTTPException(
                status_code=422, detail="Stage positions and logical keys must be unique"
            )

        type_versions = {
            item.id: item
            for item in (
                await session.scalars(
                    select(StageTypeVersion).where(
                        StageTypeVersion.id.in_(
                            [stage.stage_type_version_id for stage in payload.stages]
                        )
                    )
                )
            ).all()
        }
        for item in payload.stages:
            type_version = type_versions.get(item.stage_type_version_id)
            if type_version is None:
                raise HTTPException(status_code=422, detail="Unknown stage type version")
            validate_json_schema(type_version.property_schema, item.properties, "stage properties")

        await session.execute(
            delete(StageConnection).where(StageConnection.dataflow_version_id == version.id)
        )
        await session.execute(delete(Stage).where(Stage.dataflow_version_id == version.id))
        await session.flush()
        for item in sorted(payload.stages, key=lambda stage: stage.position):
            stage = Stage(
                id=item.id or uuid.uuid4(),
                dataflow_version_id=version.id,
                logical_key=item.logical_key,
                stage_type_version_id=item.stage_type_version_id,
                position=item.position,
                label=item.label,
                platform=item.platform,
                properties=item.properties,
                note=item.note,
            )
            session.add(stage)
            stage_by_key[stage.logical_key] = stage
        ordered = sorted(stage_by_key.values(), key=lambda stage: stage.position)
        for left, right in zip(ordered, ordered[1:], strict=False):
            session.add(
                StageConnection(
                    dataflow_version_id=version.id,
                    from_stage_id=left.id,
                    to_stage_id=right.id,
                )
            )
    else:
        stages = list(
            (
                await session.scalars(select(Stage).where(Stage.dataflow_version_id == version.id))
            ).all()
        )
        stage_by_key = {stage.logical_key: stage for stage in stages}

    if payload.measures is not None:
        await session.execute(
            delete(VersionMeasureValue).where(VersionMeasureValue.dataflow_version_id == version.id)
        )
        for item in payload.measures:
            stage = stage_by_key.get(item.stage_logical_key) if item.stage_logical_key else None
            if item.stage_logical_key and stage is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Unknown stage logical key '{item.stage_logical_key}' for measure",
                )
            session.add(
                VersionMeasureValue(
                    dataflow_version_id=version.id,
                    stage_id=stage.id if stage else None,
                    measure_definition_id=item.measure_definition_id,
                    numeric_value=item.numeric_value,
                    text_value=item.text_value,
                    source=item.source,
                    explanation=item.explanation,
                )
            )
    await session.flush()


async def clone_version(
    session: AsyncSession,
    source: DataflowVersion,
    version_name: str | None,
    change_summary: str,
) -> DataflowVersion:
    next_number = (
        await session.scalar(
            select(func.max(DataflowVersion.version_number)).where(
                DataflowVersion.dataflow_id == source.dataflow_id
            )
        )
        or 0
    ) + 1
    clone = DataflowVersion(
        dataflow_id=source.dataflow_id,
        version_number=next_number,
        version_name=version_name or f"Version {next_number}",
        change_summary=change_summary,
        business_goal=source.business_goal,
        latency_target_minutes=source.latency_target_minutes,
        monthly_budget=source.monthly_budget,
        status="draft",
        created_from_version_id=source.id,
    )
    session.add(clone)
    await session.flush()

    source_stages = list(
        (
            await session.scalars(
                select(Stage).where(Stage.dataflow_version_id == source.id).order_by(Stage.position)
            )
        ).all()
    )
    stage_map: dict[uuid.UUID, Stage] = {}
    for old in source_stages:
        new = Stage(
            dataflow_version_id=clone.id,
            logical_key=old.logical_key,
            stage_type_version_id=old.stage_type_version_id,
            position=old.position,
            label=old.label,
            platform=old.platform,
            properties=old.properties,
            note=old.note,
        )
        session.add(new)
        stage_map[old.id] = new
    await session.flush()

    for old, next_old in zip(source_stages, source_stages[1:], strict=False):
        if old.id in stage_map and next_old.id in stage_map:
            session.add(
                StageConnection(
                    dataflow_version_id=clone.id,
                    from_stage_id=stage_map[old.id].id,
                    to_stage_id=stage_map[next_old.id].id,
                )
            )

    values = list(
        (
            await session.scalars(
                select(VersionMeasureValue).where(
                    VersionMeasureValue.dataflow_version_id == source.id
                )
            )
        ).all()
    )
    for old in values:
        session.add(
            VersionMeasureValue(
                dataflow_version_id=clone.id,
                stage_id=stage_map[old.stage_id].id if old.stage_id else None,
                measure_definition_id=old.measure_definition_id,
                numeric_value=old.numeric_value,
                text_value=old.text_value,
                source="estimated",
                explanation=old.explanation,
            )
        )
    await session.flush()
    return clone


async def build_comparison(session: AsyncSession, dataflow_id: uuid.UUID) -> ComparisonOut:
    current_model = await active_version(session, dataflow_id, "current")
    proposed_model = await active_version(session, dataflow_id, "proposed")
    current = await serialize_version(session, current_model)
    proposed = await serialize_version(session, proposed_model)

    current_measures = {
        item.measure_definition_id: item for item in current.measures if not item.stage_id
    }
    proposed_measures = {
        item.measure_definition_id: item for item in proposed.measures if not item.stage_id
    }
    definitions = list(
        (
            await session.scalars(
                select(MeasureDefinition)
                .where(MeasureDefinition.enabled.is_(True))
                .order_by(MeasureDefinition.display_order, MeasureDefinition.name)
            )
        ).all()
    )
    comparisons: list[ComparisonMeasure] = []
    for definition in definitions:
        before = current_measures.get(definition.id)
        after = proposed_measures.get(definition.id)
        current_value = before.numeric_value if before else None
        proposed_value = after.numeric_value if after else None
        change, percentage, assessment = compare_numeric(
            current_value, proposed_value, definition.improvement_direction
        )
        comparisons.append(
            ComparisonMeasure(
                definition_id=definition.id,
                key=definition.key,
                name=definition.name,
                unit=definition.unit,
                value_type=definition.value_type,
                direction=definition.improvement_direction,
                current_value=current_value,
                proposed_value=proposed_value,
                absolute_change=change,
                percentage_improvement=percentage,
                assessment=assessment,
                current_text=before.text_value if before else None,
                proposed_text=after.text_value if after else None,
            )
        )

    current_stages = {stage.logical_key: stage for stage in current.stages}
    proposed_stages = {stage.logical_key: stage for stage in proposed.stages}
    differences: list[StageDifference] = []
    for key in dict.fromkeys([*current_stages, *proposed_stages]):
        before = current_stages.get(key)
        after = proposed_stages.get(key)
        if before is None:
            change_type = "added"
        elif after is None:
            change_type = "removed"
        elif before.model_dump(exclude={"id", "position"}) == after.model_dump(
            exclude={"id", "position"}
        ):
            change_type = "unchanged"
        else:
            change_type = "modified"
        differences.append(
            StageDifference(
                logical_key=key,
                current_stage=before,
                proposed_stage=after,
                change=change_type,
            )
        )

    return ComparisonOut(
        dataflow_id=dataflow_id,
        current=current,
        proposed=proposed,
        measures=comparisons,
        stage_differences=differences,
    )

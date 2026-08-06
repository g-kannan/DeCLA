import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import (
    LogType,
    LogTypeVersion,
    MeasureDefinition,
    StageType,
    StageTypeVersion,
)
from app.schemas import (
    DefinitionVersion,
    LogTypeCreate,
    LogTypeOut,
    MeasureDefinitionCreate,
    MeasureDefinitionOut,
    StageTypeCreate,
    StageTypeOut,
)

router = APIRouter(prefix="/definitions", tags=["definitions"])


def check_schema(schema: dict) -> None:
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON Schema: {exc.message}") from exc


@router.get("/stage-types", response_model=list[StageTypeOut])
async def list_stage_types(session: AsyncSession = Depends(get_session)):
    rows = (
        await session.execute(
            select(StageType, StageTypeVersion)
            .join(StageTypeVersion, StageTypeVersion.stage_type_id == StageType.id)
            .where(StageType.enabled.is_(True), StageTypeVersion.status == "published")
            .order_by(StageType.category, StageType.name, StageTypeVersion.version_number.desc())
        )
    ).all()
    seen: set[uuid.UUID] = set()
    result: list[StageTypeOut] = []
    for stage_type, version in rows:
        if stage_type.id in seen:
            continue
        seen.add(stage_type.id)
        result.append(
            StageTypeOut(
                id=stage_type.id,
                key=stage_type.key,
                name=stage_type.name,
                category=stage_type.category,
                icon=stage_type.icon,
                color=stage_type.color,
                enabled=stage_type.enabled,
                version=DefinitionVersion(
                    id=version.id,
                    version_number=version.version_number,
                    schema=version.property_schema,
                ),
            )
        )
    return result


@router.post("/stage-types", response_model=StageTypeOut, status_code=status.HTTP_201_CREATED)
async def create_stage_type(payload: StageTypeCreate, session: AsyncSession = Depends(get_session)):
    check_schema(payload.property_schema)
    if await session.scalar(select(StageType.id).where(StageType.key == payload.key)):
        raise HTTPException(status_code=409, detail="Stage type key already exists")
    stage_type = StageType(
        key=payload.key,
        name=payload.name,
        category=payload.category,
        icon=payload.icon,
        color=payload.color,
    )
    session.add(stage_type)
    await session.flush()
    version = StageTypeVersion(
        stage_type_id=stage_type.id,
        version_number=1,
        property_schema=payload.property_schema,
        status="published",
    )
    session.add(version)
    await session.commit()
    return StageTypeOut(
        id=stage_type.id,
        key=stage_type.key,
        name=stage_type.name,
        category=stage_type.category,
        icon=stage_type.icon,
        color=stage_type.color,
        enabled=stage_type.enabled,
        version=DefinitionVersion(id=version.id, version_number=1, schema=version.property_schema),
    )


@router.get("/log-types", response_model=list[LogTypeOut])
async def list_log_types(session: AsyncSession = Depends(get_session)):
    rows = (
        await session.execute(
            select(LogType, LogTypeVersion)
            .join(LogTypeVersion, LogTypeVersion.log_type_id == LogType.id)
            .where(LogType.enabled.is_(True), LogTypeVersion.status == "published")
            .order_by(LogType.name, LogTypeVersion.version_number.desc())
        )
    ).all()
    seen: set[uuid.UUID] = set()
    result: list[LogTypeOut] = []
    for log_type, version in rows:
        if log_type.id in seen:
            continue
        seen.add(log_type.id)
        result.append(
            LogTypeOut(
                id=log_type.id,
                key=log_type.key,
                name=log_type.name,
                description=log_type.description,
                enabled=log_type.enabled,
                version=DefinitionVersion(
                    id=version.id,
                    version_number=version.version_number,
                    schema=version.field_schema,
                ),
            )
        )
    return result


@router.post("/log-types", response_model=LogTypeOut, status_code=status.HTTP_201_CREATED)
async def create_log_type(payload: LogTypeCreate, session: AsyncSession = Depends(get_session)):
    check_schema(payload.field_schema)
    if await session.scalar(select(LogType.id).where(LogType.key == payload.key)):
        raise HTTPException(status_code=409, detail="Log type key already exists")
    log_type = LogType(key=payload.key, name=payload.name, description=payload.description)
    session.add(log_type)
    await session.flush()
    version = LogTypeVersion(
        log_type_id=log_type.id,
        version_number=1,
        field_schema=payload.field_schema,
        status="published",
    )
    session.add(version)
    await session.commit()
    return LogTypeOut(
        id=log_type.id,
        key=log_type.key,
        name=log_type.name,
        description=log_type.description,
        enabled=log_type.enabled,
        version=DefinitionVersion(id=version.id, version_number=1, schema=version.field_schema),
    )


@router.get("/measures", response_model=list[MeasureDefinitionOut])
async def list_measures(session: AsyncSession = Depends(get_session)):
    return list(
        (
            await session.scalars(
                select(MeasureDefinition)
                .where(MeasureDefinition.enabled.is_(True))
                .order_by(MeasureDefinition.display_order, MeasureDefinition.name)
            )
        ).all()
    )


@router.post("/measures", response_model=MeasureDefinitionOut, status_code=status.HTTP_201_CREATED)
async def create_measure(
    payload: MeasureDefinitionCreate, session: AsyncSession = Depends(get_session)
):
    if await session.scalar(
        select(MeasureDefinition.id).where(MeasureDefinition.key == payload.key)
    ):
        raise HTTPException(status_code=409, detail="Measure key already exists")
    definition = MeasureDefinition(**payload.model_dump())
    session.add(definition)
    await session.commit()
    await session.refresh(definition)
    return definition

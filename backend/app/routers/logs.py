from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import (
    LogEvent,
    LogType,
    LogTypeVersion,
    PipelineRun,
    Stage,
    StageRun,
)
from app.schemas import LogEventCreate, LogEventOut, PipelineRunCreate, PipelineRunOut
from app.service import validate_json_schema

router = APIRouter(tags=["runtime"])


@router.post("/runs", response_model=PipelineRunOut, status_code=status.HTTP_201_CREATED)
async def create_run(payload: PipelineRunCreate, session: AsyncSession = Depends(get_session)):
    if payload.external_id:
        existing = await session.scalar(
            select(PipelineRun).where(PipelineRun.external_id == payload.external_id)
        )
        if existing:
            return existing
    run = PipelineRun(**payload.model_dump(), status="running")
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return run


@router.post("/logs", response_model=LogEventOut, status_code=status.HTTP_201_CREATED)
async def create_log(payload: LogEventCreate, session: AsyncSession = Depends(get_session)):
    existing = await session.scalar(
        select(LogEvent).where(LogEvent.idempotency_key == payload.idempotency_key)
    )
    if existing:
        return existing

    run = await session.get(PipelineRun, payload.pipeline_run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    log_type_row = (
        await session.execute(
            select(LogTypeVersion, LogType)
            .join(LogType, LogType.id == LogTypeVersion.log_type_id)
            .where(
                LogType.key == payload.log_type_key,
                LogType.enabled.is_(True),
                LogTypeVersion.status == "published",
            )
            .order_by(LogTypeVersion.version_number.desc())
            .limit(1)
        )
    ).first()
    if log_type_row is None:
        raise HTTPException(status_code=422, detail="Unknown log type")
    log_type_version, _ = log_type_row
    validate_json_schema(log_type_version.field_schema, payload.payload, "log payload")

    stage_run_id = None
    if payload.stage_id:
        stage = await session.get(Stage, payload.stage_id)
        if stage is None or stage.dataflow_version_id != run.dataflow_version_id:
            raise HTTPException(status_code=422, detail="Stage does not belong to the run version")
        stage_run = await session.scalar(
            select(StageRun).where(
                StageRun.pipeline_run_id == run.id, StageRun.stage_id == payload.stage_id
            )
        )
        if stage_run is None:
            stage_run = StageRun(
                pipeline_run_id=run.id,
                stage_id=payload.stage_id,
                status="running",
                started_at=payload.occurred_at,
            )
            session.add(stage_run)
            await session.flush()
        stage_run_id = stage_run.id

    log = LogEvent(
        pipeline_run_id=run.id,
        stage_run_id=stage_run_id,
        log_type_version_id=log_type_version.id,
        idempotency_key=payload.idempotency_key,
        occurred_at=payload.occurred_at,
        severity=payload.severity,
        message=payload.message,
        source=payload.source,
        correlation_id=payload.correlation_id,
        payload=payload.payload,
    )
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log

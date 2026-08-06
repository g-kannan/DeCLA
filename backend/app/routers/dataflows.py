from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Dataflow, DataflowVersion, DataflowVersionTag
from app.schemas import (
    CloneVersionRequest,
    ComparisonOut,
    DataflowCreate,
    DataflowSummary,
    TagAssignment,
    VersionOut,
    VersionUpdate,
)
from app.service import (
    active_version,
    assign_tag,
    build_comparison,
    clone_version,
    list_dataflow_summaries,
    replace_version_content,
    serialize_version,
)

router = APIRouter(prefix="/dataflows", tags=["dataflows"])


@router.get("", response_model=list[DataflowSummary])
async def list_dataflows(session: AsyncSession = Depends(get_session)):
    return await list_dataflow_summaries(session)


@router.post("", response_model=VersionOut, status_code=status.HTTP_201_CREATED)
async def create_dataflow(payload: DataflowCreate, session: AsyncSession = Depends(get_session)):
    dataflow = Dataflow(name=payload.name, description=payload.description)
    session.add(dataflow)
    await session.flush()
    version = DataflowVersion(
        dataflow_id=dataflow.id,
        version_number=1,
        version_name="Initial architecture",
        business_goal=payload.business_goal,
        latency_target_minutes=payload.latency_target_minutes,
        monthly_budget=payload.monthly_budget,
        status="draft",
    )
    session.add(version)
    await session.flush()
    await assign_tag(session, dataflow.id, "current", version.id)
    await session.commit()
    return await serialize_version(session, version)


@router.get("/{dataflow_id}/versions", response_model=VersionOut)
async def get_tagged_version(
    dataflow_id: UUID,
    tag: str = Query(default="current", pattern=r"^[a-z][a-z0-9_-]*$"),
    session: AsyncSession = Depends(get_session),
):
    return await serialize_version(session, await active_version(session, dataflow_id, tag))


@router.get("/{dataflow_id}/version-history", response_model=list[VersionOut])
async def list_versions(dataflow_id: UUID, session: AsyncSession = Depends(get_session)):
    dataflow = await session.get(Dataflow, dataflow_id)
    if dataflow is None:
        raise HTTPException(status_code=404, detail="Dataflow not found")
    versions = (
        await session.scalars(
            select(DataflowVersion)
            .where(DataflowVersion.dataflow_id == dataflow_id)
            .order_by(DataflowVersion.version_number.desc())
        )
    ).all()
    return [await serialize_version(session, version) for version in versions]


@router.get("/{dataflow_id}/versions/{version_id}", response_model=VersionOut)
async def get_version(
    dataflow_id: UUID, version_id: UUID, session: AsyncSession = Depends(get_session)
):
    version = await session.get(DataflowVersion, version_id)
    if version is None or version.dataflow_id != dataflow_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return await serialize_version(session, version)


@router.post("/{dataflow_id}/versions", response_model=VersionOut, status_code=201)
async def create_version(
    dataflow_id: UUID,
    payload: CloneVersionRequest,
    session: AsyncSession = Depends(get_session),
):
    source = await active_version(session, dataflow_id, payload.from_tag)
    clone = await clone_version(session, source, payload.version_name, payload.change_summary)
    if payload.assign_tag:
        await assign_tag(session, dataflow_id, payload.assign_tag, clone.id)
    await session.commit()
    return await serialize_version(session, clone)


@router.patch("/{dataflow_id}/versions/{version_id}", response_model=VersionOut)
async def update_version(
    dataflow_id: UUID,
    version_id: UUID,
    payload: VersionUpdate,
    session: AsyncSession = Depends(get_session),
):
    version = await session.get(DataflowVersion, version_id)
    if version is None or version.dataflow_id != dataflow_id:
        raise HTTPException(status_code=404, detail="Version not found")
    await replace_version_content(session, version, payload)
    await session.commit()
    return await serialize_version(session, version)


@router.post("/{dataflow_id}/versions/{version_id}/publish", response_model=VersionOut)
async def publish_version(
    dataflow_id: UUID, version_id: UUID, session: AsyncSession = Depends(get_session)
):
    version = await session.get(DataflowVersion, version_id)
    if version is None or version.dataflow_id != dataflow_id:
        raise HTTPException(status_code=404, detail="Version not found")
    if version.status == "published":
        return await serialize_version(session, version)
    version.status = "published"
    version.published_at = datetime.now(UTC)
    await session.commit()
    return await serialize_version(session, version)


@router.put("/{dataflow_id}/tags/{tag}", response_model=VersionOut)
async def set_tag(
    dataflow_id: UUID,
    tag: str,
    payload: TagAssignment,
    session: AsyncSession = Depends(get_session),
):
    await assign_tag(session, dataflow_id, tag, payload.version_id)
    await session.commit()
    version = await session.get(DataflowVersion, payload.version_id)
    assert version is not None
    return await serialize_version(session, version)


@router.post("/{dataflow_id}/promote", response_model=VersionOut)
async def promote_proposed(dataflow_id: UUID, session: AsyncSession = Depends(get_session)):
    proposed = await active_version(session, dataflow_id, "proposed")
    if proposed.status != "published":
        proposed.status = "published"
        proposed.published_at = datetime.now(UTC)
    await assign_tag(session, dataflow_id, "current", proposed.id)
    await session.execute(
        update(DataflowVersionTag)
        .where(
            DataflowVersionTag.dataflow_id == dataflow_id,
            DataflowVersionTag.tag == "proposed",
            DataflowVersionTag.valid_to.is_(None),
        )
        .values(valid_to=func.now())
    )
    await session.commit()
    return await serialize_version(session, proposed)


@router.get("/{dataflow_id}/comparison", response_model=ComparisonOut)
async def compare_dataflow(dataflow_id: UUID, session: AsyncSession = Depends(get_session)):
    return await build_comparison(session, dataflow_id)

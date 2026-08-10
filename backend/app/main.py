from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.routers import dataflows, definitions, logs

settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Versioned dataflow architecture, runtime logging, and measurable comparison API.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(definitions.router, prefix="/api")
app.include_router(dataflows.router, prefix="/api")
app.include_router(logs.router, prefix="/api")


@app.get("/health/live")
async def live():
    return {"status": "ok"}


@app.get("/health/ready")
async def ready(session: AsyncSession = Depends(get_session)):
    await session.execute(text("select 1"))
    return {"status": "ready"}

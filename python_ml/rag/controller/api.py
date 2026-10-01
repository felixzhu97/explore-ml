"""HTTP routes for RAG (health + resource routers)."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel, Field
from starlette.responses import Response

from controller.crawler import router as crawler_router
from controller.documents import router as documents_router
from controller.query import router as query_router
from controller.sync import router as sync_router
from service.health import HealthService, get_health_service

SERVICE_VERSION = "1.0.0"

router = APIRouter()
router.include_router(documents_router, prefix="/api/v1")
router.include_router(crawler_router, prefix="/api/v1")
router.include_router(sync_router, prefix="/api/v1")
router.include_router(query_router, prefix="/api/v1")

HealthServiceDependency = Annotated[HealthService, Depends(get_health_service)]


class HealthStatus(BaseModel):
    status: str = "healthy"
    version: str = SERVICE_VERSION
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    services: dict[str, bool] = Field(default_factory=dict)


@router.get("/health", response_model=HealthStatus, tags=["Health"])
async def health_check(health_service: HealthServiceDependency) -> HealthStatus:
    report = await health_service.health()
    return HealthStatus(status=report.status, services=report.services)


@router.get("/health/live", tags=["Health"])
async def liveness() -> dict[str, str]:
    return {"status": "alive"}


@router.get("/health/ready", tags=["Health"])
async def readiness(health_service: HealthServiceDependency) -> JSONResponse:
    result = await health_service.readiness()
    if not result.ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not ready", "reason": result.reason},
        )
    return JSONResponse(content={"status": "ready"})


@router.get("/metrics", tags=["Monitoring"])
async def metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@router.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    return {
        "service": "RAG Service",
        "version": SERVICE_VERSION,
        "docs": "/docs",
        "health": "/health",
    }

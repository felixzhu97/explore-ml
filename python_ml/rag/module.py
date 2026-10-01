"""RAG module entry: routes, lifespan, health and error mapping for the Explore ML app."""

import logging
from contextlib import asynccontextmanager

from rag.controller.api import router
from rag.controller.errors import register_exception_handlers
from rag.service.health import get_health_service

__all__ = ["health", "lifespan", "readiness", "register_exception_handlers", "router"]

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan():
    logger.info("Starting RAG module...")
    await get_health_service().startup()
    yield
    logger.info("Shutting down RAG module...")


async def health() -> dict:
    report = await get_health_service().health()
    return {"status": "ok" if report.status == "healthy" else "degraded", **report.services}


async def readiness() -> tuple[bool, str | None]:
    result = await get_health_service().readiness()
    return result.ready, result.reason

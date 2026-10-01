"""RAG module entry: routes, lifespan, health and error mapping for the Explore ML app."""

from contextlib import asynccontextmanager

from rag.controller.api import router
from rag.controller.errors import register_exception_handlers
from rag.infra.embedding import get_embedding_service
from rag.infra.qdrant_client import get_qdrant_service

__all__ = ["health", "lifespan", "register_exception_handlers", "router"]


@asynccontextmanager
async def lifespan():
    await get_qdrant_service().initialize_collections()
    yield


async def health() -> dict:
    services = {
        "qdrant": await get_qdrant_service().health_check(),
        "embeddings": await get_embedding_service().health_check(),
    }
    return {"status": "ok" if all(services.values()) else "degraded", **services}

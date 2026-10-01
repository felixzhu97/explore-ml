"""Startup initialisation and health probes for the RAG backing services."""

import logging
from functools import lru_cache

from rag.domain.health import HealthReport, Readiness
from rag.infra.embedding import EmbeddingService, get_embedding_service
from rag.infra.qdrant_client import QdrantService, get_qdrant_service

logger = logging.getLogger(__name__)


class HealthService:
    def __init__(self, qdrant: QdrantService, embeddings: EmbeddingService) -> None:
        self._qdrant = qdrant
        self._embeddings = embeddings

    async def startup(self) -> None:
        try:
            await self._qdrant.initialize_collections()
            logger.info("Qdrant collections initialized")
        except Exception as error:
            logger.warning("Qdrant initialization failed: %s", error)

    async def health(self) -> HealthReport:
        return HealthReport(
            services={
                "qdrant": await _is_healthy(self._qdrant),
                "embeddings": await _is_healthy(self._embeddings),
            }
        )

    async def readiness(self) -> Readiness:
        try:
            if not await self._qdrant.health_check():
                return Readiness(ready=False, reason="Qdrant unavailable")
            return Readiness(ready=True)
        except Exception as error:
            return Readiness(ready=False, reason=str(error))


async def _is_healthy(dependency: QdrantService | EmbeddingService) -> bool:
    try:
        return await dependency.health_check()
    except Exception:
        return False


@lru_cache
def get_health_service() -> HealthService:
    return HealthService(get_qdrant_service(), get_embedding_service())

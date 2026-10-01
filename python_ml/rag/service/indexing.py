"""Embed text chunks and upsert them into a vector collection."""

from collections.abc import Callable
from functools import lru_cache
from typing import Any

from rag.domain.chunker import Chunk
from rag.infra.embedding import EmbeddingService, get_embedding_service
from rag.infra.qdrant_client import QdrantService, get_qdrant_service

EMBEDDING_BATCH_SIZE = 10


class ChunkIndexer:
    def __init__(self, embeddings: EmbeddingService, qdrant: QdrantService) -> None:
        self._embeddings = embeddings
        self._qdrant = qdrant

    async def index(
        self,
        collection: str,
        chunks: list[Chunk],
        payload_for: Callable[[Chunk], dict[str, Any]],
    ) -> None:
        points = []
        for start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
            batch = chunks[start : start + EMBEDDING_BATCH_SIZE]
            vectors = await self._embeddings.embed([chunk.text for chunk in batch])
            points.extend(
                {
                    "id": chunk.id,
                    "vector": vector,
                    "payload": {"text": chunk.text, **payload_for(chunk)},
                }
                for chunk, vector in zip(batch, vectors, strict=True)
            )
        if points:
            await self._qdrant.upsert(collection, points)


@lru_cache
def get_chunk_indexer() -> ChunkIndexer:
    return ChunkIndexer(get_embedding_service(), get_qdrant_service())

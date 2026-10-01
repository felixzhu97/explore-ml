"""Answer questions from retrieved chunks and export stored vectors."""

import logging
import time
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

from domain.query import (
    NO_RESULTS_ANSWER,
    RERANK_CANDIDATE_FACTOR,
    SEARCHABLE_COLLECTIONS,
    SOURCE_TEXT_LIMIT,
    Answer,
    ExportedPoint,
    ExportedVectors,
    SearchHit,
    build_system_prompt,
)
from domain.rerank import apply_rerank_scores
from infra.embedding import EmbeddingService, get_embedding_service
from infra.llm import LlmClient, get_llm_client
from infra.qdrant_client import QdrantService, get_qdrant_service
from infra.reranker import rerank_documents

logger = logging.getLogger(__name__)


class QueryService:
    def __init__(
        self, embeddings: EmbeddingService, qdrant: QdrantService, llm: LlmClient
    ) -> None:
        self._embeddings = embeddings
        self._qdrant = qdrant
        self._llm = llm

    async def answer(
        self, question: str, collection: str | None, top_k: int, include_sources: bool
    ) -> Answer:
        start_time = time.time()
        top_hits, total_searched = await self._retrieve(question, collection, top_k)
        if not top_hits:
            return Answer(
                text=NO_RESULTS_ANSWER,
                sources=[],
                total_chunks_searched=0,
                generation_time_ms=_elapsed_ms(start_time),
            )

        system_prompt = build_system_prompt([hit.text for hit in top_hits])
        text = await self._llm.complete(system_prompt, question)
        generation_time_ms = _elapsed_ms(start_time)
        logger.info(
            "Query processed in %sms: %s sources retrieved",
            generation_time_ms,
            len(top_hits),
        )
        return Answer(
            text=text,
            sources=top_hits if include_sources else [],
            total_chunks_searched=total_searched,
            generation_time_ms=generation_time_ms,
        )

    async def stream_answer(
        self, question: str, collection: str | None, top_k: int
    ) -> AsyncIterator[str]:
        """Retrieve eagerly so search failures surface before streaming starts."""
        top_hits, _ = await self._retrieve(question, collection, top_k)
        if not top_hits:
            return _single(NO_RESULTS_ANSWER)
        system_prompt = build_system_prompt([hit.text for hit in top_hits])
        return self._llm.stream(system_prompt, question)

    async def export_vectors(self, collection: str | None, limit: int) -> ExportedVectors:
        names = [collection] if collection else await self._qdrant.get_collections()
        points: list[ExportedPoint] = []
        for name in names:
            remaining = limit - len(points)
            if remaining <= 0:
                break
            for record in await self._qdrant.scroll_vectors(name, remaining):
                metadata = dict(record["payload"])
                text = str(metadata.pop("text", ""))[:SOURCE_TEXT_LIMIT]
                metadata.setdefault("collection", name)
                points.append(
                    ExportedPoint(
                        id=record["id"],
                        vector=record["vector"],
                        text=text,
                        metadata=metadata,
                    )
                )
        return ExportedVectors(points=points)

    async def list_collections(self) -> list[dict[str, Any]]:
        return [
            await self._qdrant.get_collection_info(name)
            for name in await self._qdrant.get_collections()
        ]

    async def _retrieve(
        self, question: str, collection: str | None, top_k: int
    ) -> tuple[list[SearchHit], int]:
        """Vector search, then optional rerank; returns (top hits, total searched)."""
        query_vector = await self._embeddings.embed_single(question)
        all_records = await self._search(query_vector, collection, top_k)
        candidates = all_records[: top_k * RERANK_CANDIDATE_FACTOR]
        rerank_scores = await rerank_documents(
            question, [record["payload"].get("text", "") for record in candidates]
        )
        if rerank_scores is not None:
            candidates = apply_rerank_scores(candidates, rerank_scores)
        return [SearchHit.from_record(record) for record in candidates[:top_k]], len(
            all_records
        )

    async def _search(
        self, query_vector: list[float], collection: str | None, top_k: int
    ) -> list[dict]:
        records: list[dict] = []
        for name in [collection] if collection else SEARCHABLE_COLLECTIONS:
            try:
                records.extend(
                    await self._qdrant.search(
                        collection=name, query_vector=query_vector, top_k=top_k
                    )
                )
            except Exception as error:
                logger.warning("Failed to search collection %s: %s", name, error)
        records.sort(key=lambda record: record["score"], reverse=True)
        return records


async def _single(text: str) -> AsyncIterator[str]:
    yield text


def _elapsed_ms(start_time: float) -> int:
    return int((time.time() - start_time) * 1000)


@lru_cache
def get_query_service() -> QueryService:
    return QueryService(get_embedding_service(), get_qdrant_service(), get_llm_client())

"""Recommendation use cases: rank candidates and recall similar items."""

from __future__ import annotations

import os
from functools import lru_cache

from recommendation.domain.vector_store import VectorStore
from recommendation.infra.factories import RankerFactory, VectorStoreFactory
from recommendation.infra.feed_ranker import FeedRankingService
from recommendation.infra.vector_store import RedisVectorStore

FALLBACK_SCORE = 1.0


class RecommendationService:
    """Lazily builds the feed ranker and vector stores on first use."""

    def __init__(self) -> None:
        self._ranker: FeedRankingService | None = None
        self._ranker_loaded = False
        self._vector_stores: dict[str, VectorStore] = {}

    @property
    def ranker(self) -> FeedRankingService | None:
        if not self._ranker_loaded:
            self._ranker = RankerFactory.create_ranker()
            self._ranker_loaded = True
        return self._ranker

    def vector_store(self) -> VectorStore:
        backend = os.getenv("VECTOR_BACKEND", "redis").lower()
        if backend not in self._vector_stores:
            self._vector_stores[backend] = (
                VectorStoreFactory.create_faiss_store()
                if backend == "faiss"
                else VectorStoreFactory.create_redis_store()
            )
        return self._vector_stores[backend]

    def clear(self) -> None:
        self._ranker = None
        self._ranker_loaded = False
        self._vector_stores.clear()

    def rank_candidates(
        self,
        user_id: str,
        candidate_ids: list[str],
        *,
        limit: int = 50,
        region: str | None = None,
        language: str | None = None,
        experiment_id: str | None = None,
        variant_id: str | None = None,
    ) -> list[tuple[str, float]]:
        if not candidate_ids:
            return []
        ranker = self.ranker
        if ranker is None:
            return [(candidate_id, FALLBACK_SCORE) for candidate_id in candidate_ids[:limit]]
        ranked = ranker.rank(
            user_id,
            candidate_ids,
            region=region,
            language=language,
            experiment_id=experiment_id,
            variant_id=variant_id,
        )
        return ranked[:limit]

    def recall_similar_items(self, user_id: str, limit: int) -> list[tuple[str, float]]:
        store = self.vector_store()
        if not isinstance(store, RedisVectorStore):
            return []
        stored_vector = store.client.get(f"{store.user_key_prefix}{user_id}")
        if not stored_vector:
            return []
        user_vector = [float(component) for component in stored_vector.split(",") if component]
        return store.query_similar_items(user_vector, limit)


@lru_cache
def get_recommendation_service() -> RecommendationService:
    return RecommendationService()

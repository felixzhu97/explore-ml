"""Recommendation use cases: rank candidates and recall similar items."""

from __future__ import annotations

from functools import cached_property, lru_cache

from recommendation.domain.vector_store import VectorStore
from recommendation.infra.factories import RankerFactory, VectorStoreFactory
from recommendation.infra.feed_ranker import FeedRankingService
from recommendation.infra.vector_store import RedisVectorStore

FALLBACK_SCORE = 1.0


class RecommendationService:
    """Builds the feed ranker and vector store on first use."""

    @cached_property
    def ranker(self) -> FeedRankingService | None:
        return RankerFactory.create_ranker()

    @cached_property
    def vector_store(self) -> VectorStore:
        return VectorStoreFactory.get_vector_store()

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
        store = self.vector_store
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

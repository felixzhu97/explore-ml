"""HTTP routes for recommendation ranking and recall (AIP custom methods)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from recommendation.service.recommendation import RecommendationService, get_recommendation_service

router = APIRouter()

RecommendationServiceDependency = Annotated[
    RecommendationService, Depends(get_recommendation_service)
]


class RankRequest(BaseModel):
    user_id: str
    candidate_ids: list[str]
    limit: int | None = 50
    region: str | None = None
    language: str | None = None
    experiment_id: str | None = None
    variant_id: str | None = None


class RecallRequest(BaseModel):
    user_id: str
    limit: int | None = 100


class RankedItem(BaseModel):
    id: str
    score: float


class RankedItemsResponse(BaseModel):
    items: list[RankedItem]

    @classmethod
    def from_pairs(cls, scored_ids: list[tuple[str, float]]) -> "RankedItemsResponse":
        return cls(items=[RankedItem(id=item_id, score=score) for item_id, score in scored_ids])


def _rank(
    request: RankRequest, recommendation_service: RecommendationService
) -> RankedItemsResponse:
    ranked = recommendation_service.rank_candidates(
        request.user_id,
        request.candidate_ids,
        limit=request.limit or 50,
        region=request.region,
        language=request.language,
        experiment_id=request.experiment_id,
        variant_id=request.variant_id,
    )
    return RankedItemsResponse.from_pairs(ranked)


@router.post("/api/v1/feeds:rank")
def rank_feeds(
    request: RankRequest, recommendation_service: RecommendationServiceDependency
) -> RankedItemsResponse:
    return _rank(request, recommendation_service)


@router.post("/api/v1/explores:rank")
def rank_explores(
    request: RankRequest, recommendation_service: RecommendationServiceDependency
) -> RankedItemsResponse:
    return _rank(request, recommendation_service)


@router.post("/api/v1/reels:rank")
def rank_reels(
    request: RankRequest, recommendation_service: RecommendationServiceDependency
) -> RankedItemsResponse:
    return _rank(request, recommendation_service)


@router.post("/api/v1/feeds:recall")
def recall_feeds(
    request: RecallRequest, recommendation_service: RecommendationServiceDependency
) -> RankedItemsResponse:
    items = recommendation_service.recall_similar_items(request.user_id, request.limit or 100)
    return RankedItemsResponse.from_pairs(items)

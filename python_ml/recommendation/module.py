"""Recommendation module entry: routes and health for the Explore ML app."""

from recommendation.controller.api import router
from recommendation.service.recommendation import get_recommendation_service

__all__ = ["health", "router"]


async def health() -> dict:
    return {"status": "ok", "ranker": get_recommendation_service().ranker is not None}

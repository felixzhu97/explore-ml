"""Recommendation module entry: routes, lifespan and health for the Explore ML app."""

import logging
from contextlib import asynccontextmanager

from recommendation.controller.api import router
from recommendation.service.recommendation import get_recommendation_service

__all__ = ["health", "lifespan", "router"]

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan():
    recommendation_service = get_recommendation_service()
    if recommendation_service.ranker:
        logger.info("Ranker loaded successfully")
    yield
    recommendation_service.clear()


async def health() -> dict:
    return {"status": "ok", "ranker": get_recommendation_service().ranker is not None}

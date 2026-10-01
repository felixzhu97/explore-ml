"""Recommendation FastAPI entrypoint — uvicorn main:app."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

import config
from controller.api import router
from service.recommendation import get_recommendation_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    recommendation_service = get_recommendation_service()
    if recommendation_service.ranker:
        logger.info("Ranker loaded successfully")
    yield
    recommendation_service.clear()


app = FastAPI(title="Recommendation API", lifespan=lifespan)
app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=False)

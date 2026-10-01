"""Video module entry: routes, lifespan and health for the Explore ML app."""

from contextlib import asynccontextmanager

from video import config
from video.controller.api import router
from video.infra import pipeline
from video.service.video import get_video_service

__all__ = ["health", "lifespan", "router"]


@asynccontextmanager
async def lifespan():
    get_video_service().startup()
    yield


async def health() -> dict:
    return {
        "status": "ok",
        "model": config.COGVIDEOX_MODEL,
        "local": not pipeline.skip_video_local(),
    }

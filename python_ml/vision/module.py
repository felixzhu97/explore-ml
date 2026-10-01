"""Vision module entry: routes, lifespan and health for the Explore ML app."""

from contextlib import asynccontextmanager

from vision import config
from vision.controller.api import router
from vision.service.vision import get_vision_service

__all__ = ["health", "lifespan", "router"]


@asynccontextmanager
async def lifespan():
    get_vision_service().startup()
    yield


async def health() -> dict:
    return {"status": "ok", "model": "fine_tuned" if config.MODEL_PATH else "resnet50"}

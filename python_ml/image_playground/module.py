"""Image Playground module entry: routes and health for the Explore ML app."""

from image_playground import config
from image_playground.controller.api import router

__all__ = ["health", "router"]


async def health() -> dict:
    return {
        "status": "ok",
        "backend": config.IMAGE_BACKEND,
        "lora": config.IMAGE_LORA_PATH is not None,
    }

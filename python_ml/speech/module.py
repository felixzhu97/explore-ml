"""Speech module entry: routes and health for the Explore ML app."""

from speech import config
from speech.controller.api import router

__all__ = ["health", "router"]


async def health() -> dict:
    return {"status": "ok", "voice": config.VOICE_BACKEND, "asr": config.ASR_BACKEND}

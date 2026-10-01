"""Explore ML entrypoint — every module on one port: `uvicorn main:app --port 8000`."""

import logging

import config
import image_playground.module
import rag.module
import recommendation.module
import speech.module
import video.module
import vision.module
from server import build_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = build_app({
    "recommendation": recommendation.module,
    "vision": vision.module,
    "rag": rag.module,
    "image_playground": image_playground.module,
    "speech": speech.module,
    "video": video.module,
})
rag.module.register_exception_handlers(app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)

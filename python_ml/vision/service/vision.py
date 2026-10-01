import logging
from typing import Any, Optional

import config
from domain.moderation import max_explicit_score, verdict
from infra import models, video
from PIL import Image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("vision")


def startup():
    models.load_labels()
    models.load_model()
    models.load_nsfw_detector()


def open_image_bytes(content: bytes) -> Optional[Image.Image]:
    return models.open_image_bytes(content)


def predict_image(image: Image.Image) -> list[str]:
    return models.top_labels(image, config.TOP_K)


def moderate_image(image: Image.Image) -> dict[str, Any]:
    categories: list[dict[str, Any]] = []
    # PROHIBITED_INDICES are ImageNet class ids; a fine-tuned head has its own labels.
    if not config.MODEL_PATH:
        for score in models.class_scores(image, config.PROHIBITED_INDICES):
            if score >= config.MODERATION_THRESHOLD:
                categories.append({"label": "prohibited", "score": round(score, 4)})
    if config.NSFW_ENABLED:
        nude_score = max_explicit_score(
            models.nsfw_detections(image),
            config.NSFW_THRESHOLD,
            config.NSFW_EXPLICIT_CLASSES,
        )
        if nude_score >= config.NSFW_THRESHOLD:
            categories.append({"label": "nude", "score": round(nude_score, 4)})
    result = verdict(categories)
    if not result["safe"]:
        log.info("moderation reject: %s", result["categories"])
    return result


def moderate_video(video_path: str) -> dict[str, Any]:
    frames = video.extract_frames(
        video_path, config.VIDEO_FRAME_INTERVAL_SEC, config.MAX_VIDEO_FRAMES
    )
    categories: list[dict[str, Any]] = []
    for frame in frames:
        categories.extend(moderate_image(frame)["categories"])
    return verdict(categories)

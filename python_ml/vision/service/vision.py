"""Vision use cases: image classification plus image and video moderation."""

import logging
from functools import lru_cache

from PIL import Image

import config
from domain.moderation import ModerationCategory, ModerationVerdict, max_explicit_score, verdict
from infra import models, video

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vision")


class VisionService:
    def startup(self) -> None:
        models.load_labels()
        models.load_model()
        models.load_nsfw_detector()

    def open_image_bytes(self, content: bytes) -> Image.Image | None:
        return models.open_image_bytes(content)

    def predict_image(self, image: Image.Image) -> list[str]:
        return models.top_labels(image, config.TOP_K)

    def moderate_image(self, image: Image.Image) -> ModerationVerdict:
        categories: list[ModerationCategory] = []
        # PROHIBITED_INDICES are ImageNet class ids; a fine-tuned head has its own labels.
        if not config.MODEL_PATH:
            for score in models.class_scores(image, config.PROHIBITED_INDICES):
                if score >= config.MODERATION_THRESHOLD:
                    categories.append(ModerationCategory("prohibited", round(score, 4)))
        if config.NSFW_ENABLED:
            nude_score = max_explicit_score(
                models.nsfw_detections(image),
                config.NSFW_THRESHOLD,
                config.NSFW_EXPLICIT_CLASSES,
            )
            if nude_score >= config.NSFW_THRESHOLD:
                categories.append(ModerationCategory("nude", round(nude_score, 4)))
        result = verdict(categories)
        if not result.safe:
            logger.info("moderation reject: %s", result.categories)
        return result

    def moderate_video(self, video_path: str) -> ModerationVerdict:
        frames = video.extract_frames(
            video_path, config.VIDEO_FRAME_INTERVAL_SEC, config.MAX_VIDEO_FRAMES
        )
        categories: list[ModerationCategory] = []
        for frame in frames:
            categories.extend(self.moderate_image(frame).categories)
        return verdict(categories)


@lru_cache
def get_vision_service() -> VisionService:
    return VisionService()

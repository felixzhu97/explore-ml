"""Vision use cases: image classification plus image and video moderation."""

import logging
from functools import lru_cache

from PIL import Image

from vision import config
from vision.domain.moderation import (
    FrameVerdict,
    ModerationCategory,
    ModerationVerdict,
    flagged,
    max_explicit_score,
    verdict,
)
from vision.domain.prediction import Prediction
from vision.infra import models, video

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vision")


class VisionService:
    def startup(self) -> None:
        models.load_labels()
        models.load_model()
        models.load_nsfw_detector()

    def open_image_bytes(self, content: bytes) -> Image.Image | None:
        return models.open_image_bytes(content)

    def predict_image(self, image: Image.Image) -> list[Prediction]:
        return models.top_predictions(image, config.TOP_K)

    def thresholds(self) -> dict[str, float]:
        thresholds: dict[str, float] = {}
        # PROHIBITED_INDICES are ImageNet class ids; a fine-tuned head has its own labels.
        if not config.MODEL_PATH:
            thresholds["prohibited"] = config.MODERATION_THRESHOLD
        if config.NSFW_ENABLED:
            thresholds["nude"] = config.NSFW_THRESHOLD
        return thresholds

    def category_scores(self, image: Image.Image) -> dict[str, float]:
        scores: dict[str, float] = {}
        if not config.MODEL_PATH:
            scores["prohibited"] = max(
                models.class_scores(image, config.PROHIBITED_INDICES), default=0.0
            )
        if config.NSFW_ENABLED:
            scores["nude"] = max_explicit_score(
                models.nsfw_detections(image),
                config.NSFW_THRESHOLD,
                config.NSFW_EXPLICIT_CLASSES,
            )
        return scores

    def moderate_image(self, image: Image.Image) -> ModerationVerdict:
        scores = {
            label: round(score, 4) for label, score in self.category_scores(image).items()
        }
        result = verdict(flagged(scores, self.thresholds()), scores=scores)
        if not result.safe:
            logger.info("moderation reject: %s", result.categories)
        return result

    def moderate_video(self, video_path: str) -> ModerationVerdict:
        thresholds = self.thresholds()
        categories: list[ModerationCategory] = []
        frames: list[FrameVerdict] = []
        for offset_seconds, frame in video.extract_frames(
            video_path, config.VIDEO_FRAME_INTERVAL_SEC, config.MAX_VIDEO_FRAMES
        ):
            scores = self.category_scores(frame)
            frame_categories = flagged(scores, thresholds)
            categories.extend(frame_categories)
            frames.append(
                FrameVerdict(
                    offset_seconds=round(offset_seconds, 2),
                    scores={label: round(score, 4) for label, score in scores.items()},
                    safe=not frame_categories,
                )
            )
        return verdict(categories, frames)


@lru_cache
def get_vision_service() -> VisionService:
    return VisionService()

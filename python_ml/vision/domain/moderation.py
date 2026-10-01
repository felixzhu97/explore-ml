"""Moderation rules: explicit classes and verdict aggregation."""

from collections.abc import Iterable
from dataclasses import dataclass, field

EXPLICIT_PARTS = ("GENITALIA", "BREAST", "BUTTOCKS", "ANUS")


@dataclass(frozen=True)
class ModerationCategory:
    label: str
    score: float


@dataclass(frozen=True)
class FrameVerdict:
    """Raw category scores for one sampled video frame."""

    offset_seconds: float
    scores: dict[str, float]
    safe: bool


@dataclass(frozen=True)
class ModerationVerdict:
    safe: bool
    categories: list[ModerationCategory] = field(default_factory=list)
    scores: dict[str, float] = field(default_factory=dict)
    frames: list[FrameVerdict] = field(default_factory=list)


def flagged(scores: dict[str, float], thresholds: dict[str, float]) -> list[ModerationCategory]:
    """Categories whose score reaches their threshold."""
    return [
        ModerationCategory(label, round(score, 4))
        for label, score in scores.items()
        if label in thresholds and score >= thresholds[label]
    ]


def is_explicit_class(class_name: str) -> bool:
    upper_name = class_name.upper()
    if "EXPOSED" not in upper_name:
        return False
    return any(part in upper_name for part in EXPLICIT_PARTS)


def max_explicit_score(
    detections: Iterable[tuple[str, float]],
    threshold: float,
    explicit_classes: Iterable[str],
) -> float:
    explicit = set(explicit_classes)
    max_score = 0.0
    for class_name, score in detections:
        if score < threshold:
            continue
        if (class_name in explicit or is_explicit_class(class_name)) and score > max_score:
            max_score = score
    return max_score


def peak_scores(frames: Iterable[FrameVerdict]) -> dict[str, float]:
    """Highest score per category across frames."""
    peaks: dict[str, float] = {}
    for frame in frames:
        for label, score in frame.scores.items():
            peaks[label] = max(score, peaks.get(label, score))
    return peaks


def verdict(
    categories: Iterable[ModerationCategory],
    frames: Iterable[FrameVerdict] = (),
    scores: dict[str, float] | None = None,
) -> ModerationVerdict:
    """Keep the highest score per flagged label; `scores` defaults to the frame peaks."""
    best_score_by_label: dict[str, float] = {}
    for category in categories:
        if category.label and category.score > best_score_by_label.get(category.label, -1.0):
            best_score_by_label[category.label] = category.score
    frames = list(frames)
    return ModerationVerdict(
        safe=not best_score_by_label,
        categories=[
            ModerationCategory(label, score) for label, score in best_score_by_label.items()
        ],
        scores=dict(scores) if scores is not None else peak_scores(frames),
        frames=frames,
    )

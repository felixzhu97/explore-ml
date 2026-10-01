"""Moderation rules: explicit classes and verdict aggregation."""

from collections.abc import Iterable
from dataclasses import dataclass, field

EXPLICIT_PARTS = ("GENITALIA", "BREAST", "BUTTOCKS", "ANUS")


@dataclass(frozen=True)
class ModerationCategory:
    label: str
    score: float


@dataclass(frozen=True)
class ModerationVerdict:
    safe: bool
    categories: list[ModerationCategory] = field(default_factory=list)


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


def verdict(categories: Iterable[ModerationCategory]) -> ModerationVerdict:
    """Keep the highest score per label; safe when nothing was flagged."""
    best_score_by_label: dict[str, float] = {}
    for category in categories:
        if category.label and category.score > best_score_by_label.get(category.label, -1.0):
            best_score_by_label[category.label] = category.score
    return ModerationVerdict(
        safe=not best_score_by_label,
        categories=[
            ModerationCategory(label, score) for label, score in best_score_by_label.items()
        ],
    )

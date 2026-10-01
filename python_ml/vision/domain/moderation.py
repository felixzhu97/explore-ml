"""Moderation rules: explicit classes and verdict aggregation."""

from typing import Any, Iterable

EXPLICIT_PARTS = ("GENITALIA", "BREAST", "BUTTOCKS", "ANUS")


def is_explicit_class(cls_name: str) -> bool:
    if not cls_name or "EXPOSED" not in cls_name.upper():
        return False
    u = cls_name.upper()
    return any(x in u for x in EXPLICIT_PARTS)


def max_explicit_score(
    detections: Iterable[tuple[str, float]],
    threshold: float,
    explicit_classes: Iterable[str],
) -> float:
    explicit = set(explicit_classes)
    max_score = 0.0
    for cls_name, score in detections:
        if score < threshold:
            continue
        if (cls_name in explicit or is_explicit_class(cls_name)) and score > max_score:
            max_score = score
    return max_score


def verdict(categories: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Keep the highest score per label; safe when nothing was flagged."""
    best_by_label: dict[str, float] = {}
    for c in categories:
        label = c.get("label", "")
        score = c.get("score", 0.0)
        if label and (label not in best_by_label or score > best_by_label[label]):
            best_by_label[label] = score
    if not best_by_label:
        return {"safe": True, "categories": []}
    return {
        "safe": False,
        "categories": [{"label": k, "score": v} for k, v in best_by_label.items()],
    }

"""Classification results: one probability per label, highest first."""

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class Prediction:
    label: str
    score: float


def top_unique(predictions: Iterable[Prediction], limit: int) -> list[Prediction]:
    """Keep the first (highest) prediction per label, up to `limit` labels."""
    seen: set[str] = set()
    unique: list[Prediction] = []
    for prediction in predictions:
        if prediction.label in seen:
            continue
        seen.add(prediction.label)
        unique.append(prediction)
        if len(unique) == limit:
            break
    return unique

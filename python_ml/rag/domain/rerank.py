"""Rerank scoring rules."""
from __future__ import annotations


def apply_rerank_scores(
    results: list[dict],
    scores: list[float],
) -> list[dict]:
    """Attach rerank scores and sort descending."""
    ranked = []
    for result, score in zip(results, scores):
        item = dict(result)
        item["score"] = score
        ranked.append(item)
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked

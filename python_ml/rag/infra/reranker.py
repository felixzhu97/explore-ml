"""Optional HTTP client for local Qwen3-Reranker serve."""
from __future__ import annotations

import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)


async def rerank_documents(
    query: str,
    documents: list[str],
) -> list[float] | None:
    """Return yes-probs aligned with documents, or None if disabled / unavailable."""
    settings = get_settings()
    if not settings.rerank_enabled or not documents:
        return None
    url = f"{settings.rerank_url.rstrip('/')}/rerank"
    try:
        async with httpx.AsyncClient(timeout=settings.rerank_timeout) as client:
            response = await client.post(
                url,
                json={"query": query, "documents": documents},
            )
            response.raise_for_status()
            payload = response.json()
            scores = payload.get("scores")
            if not isinstance(scores, list) or len(scores) != len(documents):
                logger.warning("Rerank response shape mismatch; skipping")
                return None
            return [float(score) for score in scores]
    except Exception as error:
        logger.warning("Rerank unavailable (%s); continuing without rerank", error)
        return None

"""Optional HTTP client for local Qwen3-Reranker serve."""
from __future__ import annotations

import logging

import httpx

from rag import config

logger = logging.getLogger(__name__)


async def rerank_documents(
    query: str,
    documents: list[str],
) -> list[float] | None:
    """Return yes-probs aligned with documents, or None if disabled / unavailable."""
    if not config.RERANK_ENABLED or not documents:
        return None
    try:
        async with httpx.AsyncClient(timeout=config.RERANK_TIMEOUT) as client:
            response = await client.post(
                f"{config.RERANK_URL}/rerank",
                json={"query": query, "documents": documents},
            )
            response.raise_for_status()
            return response.json()["scores"]
    except Exception as error:
        logger.warning("Rerank unavailable (%s); continuing without rerank", error)
        return None

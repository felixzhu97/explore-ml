"""Sync posts and comments from the content API into the vector store."""

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

from rag.domain.chunker import TextChunker, get_chunker
from rag.domain.sync import SyncResult
from rag.infra.content_api import ContentApiClient, get_content_api_client
from rag.service.indexing import ChunkIndexer, get_chunk_indexer

logger = logging.getLogger(__name__)

FULL_SYNC_LIMIT = 1000


class SyncService:
    def __init__(
        self,
        chunker: TextChunker,
        indexer: ChunkIndexer,
        content_api: ContentApiClient,
    ) -> None:
        self._chunker = chunker
        self._indexer = indexer
        self._content_api = content_api

    async def sync_posts(
        self,
        post_ids: list[str] | None = None,
        limit: int = FULL_SYNC_LIMIT,
        since_hours: int | None = None,
    ) -> SyncResult:
        params: dict[str, Any] = {"limit": limit}
        if post_ids:
            params["ids"] = ",".join(post_ids)
        if since_hours:
            since = datetime.now(UTC) - timedelta(hours=since_hours)
            params["since"] = since.isoformat()
        return await self._sync(
            source_type="post",
            resource="posts",
            params=params,
            extra_fields=lambda post: {
                "author_id": post.get("author_id", ""),
                "created_at": post.get("created_at", ""),
            },
        )

    async def sync_comments(
        self,
        comment_ids: list[str] | None = None,
        post_ids: list[str] | None = None,
        limit: int = FULL_SYNC_LIMIT,
    ) -> SyncResult:
        params: dict[str, Any] = {"limit": limit}
        if comment_ids:
            params["ids"] = ",".join(comment_ids)
        if post_ids:
            params["post_ids"] = ",".join(post_ids)
        return await self._sync(
            source_type="comment",
            resource="comments",
            params=params,
            extra_fields=lambda comment: {
                "post_id": comment.get("post_id", ""),
                "author_id": comment.get("author_id", ""),
                "created_at": comment.get("created_at", ""),
            },
        )

    async def _sync(
        self,
        source_type: str,
        resource: str,
        params: dict[str, Any],
        extra_fields: Callable[[dict], dict[str, Any]],
    ) -> SyncResult:
        start_time = time.time()
        records = await self._content_api.list_records(resource, params)
        result = SyncResult(total=len(records))

        for record in records:
            try:
                content = record.get("content", "")
                document_id = f"{source_type}_{record['id']}"
                fields = {
                    "source_type": source_type,
                    "source_id": record["id"],
                    **extra_fields(record),
                }
                chunks = (
                    self._chunker.chunk_text(
                        content, {**fields, "doc_id": document_id}, document_id
                    )
                    if content
                    else []
                )
                if not chunks:
                    result.skipped += 1
                    continue
                await self._indexer.index(
                    resource, chunks, lambda _chunk: {"doc_id": document_id, **fields}
                )
                result.successful += 1
            except Exception as error:
                result.failed += 1
                result.errors.append(f"{source_type.capitalize()} {record.get('id')}: {error}")
                logger.error("Failed to sync %s %s: %s", source_type, record.get("id"), error)

        result.duration_ms = int((time.time() - start_time) * 1000)
        logger.info(
            "Synced %s: %s/%s successful, %s skipped",
            resource,
            result.successful,
            result.total,
            result.skipped,
        )
        return result


@lru_cache
def get_sync_service() -> SyncService:
    return SyncService(get_chunker(), get_chunk_indexer(), get_content_api_client())

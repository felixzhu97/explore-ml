"""Database sync API routes."""

from dataclasses import asdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from rag.service.sync import FULL_SYNC_LIMIT, SyncService, get_sync_service

router = APIRouter(tags=["Sync"])

SyncServiceDependency = Annotated[SyncService, Depends(get_sync_service)]


class SyncPostsRequest(BaseModel):
    post_ids: list[str] | None = Field(
        default=None,
        description="Specific post IDs to sync. If None, sync all recent posts.",
    )
    limit: int = Field(default=FULL_SYNC_LIMIT, ge=1, le=10000)
    since_hours: int | None = Field(
        default=None, description="Sync posts from the last N hours."
    )


class SyncCommentsRequest(BaseModel):
    comment_ids: list[str] | None = Field(
        default=None, description="Specific comment IDs to sync."
    )
    limit: int = Field(default=FULL_SYNC_LIMIT, ge=1, le=10000)
    post_ids: list[str] | None = Field(
        default=None, description="Sync comments only for specific posts."
    )


class SyncResultResponse(BaseModel):
    total: int
    successful: int
    failed: int
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)
    duration_ms: int = 0


@router.post("/posts:sync", response_model=SyncResultResponse)
async def sync_posts(
    sync_service: SyncServiceDependency, request: SyncPostsRequest | None = None
) -> SyncResultResponse:
    """Sync posts from the database to the vector store."""
    request = request or SyncPostsRequest()
    result = await sync_service.sync_posts(
        post_ids=request.post_ids, limit=request.limit, since_hours=request.since_hours
    )
    return SyncResultResponse(**asdict(result))


@router.post("/comments:sync", response_model=SyncResultResponse)
async def sync_comments(
    sync_service: SyncServiceDependency, request: SyncCommentsRequest | None = None
) -> SyncResultResponse:
    """Sync comments from the database to the vector store."""
    request = request or SyncCommentsRequest()
    result = await sync_service.sync_comments(
        comment_ids=request.comment_ids, post_ids=request.post_ids, limit=request.limit
    )
    return SyncResultResponse(**asdict(result))


@router.post("/resources:sync")
async def sync_all(sync_service: SyncServiceDependency) -> dict[str, Any]:
    """Sync all content types (posts and comments)."""
    posts = await sync_service.sync_posts()
    comments = await sync_service.sync_comments()
    return {"posts": asdict(posts), "comments": asdict(comments), "status": "completed"}

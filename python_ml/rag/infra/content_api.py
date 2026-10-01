"""Read posts and comments from the WhatsFeed content API."""

from functools import lru_cache
from typing import Any

import httpx

from rag.config import get_settings
from rag.domain.errors import UpstreamError

REQUEST_TIMEOUT_SECONDS = 60


class ContentApiClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url

    async def list_records(self, resource: str, params: dict[str, Any]) -> list[dict]:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(f"{self._base_url}/{resource}", params=params)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as error:
                raise UpstreamError(
                    error.response.status_code,
                    f"Failed to fetch {resource} from database: {error}",
                ) from error
            return response.json()


@lru_cache
def get_content_api_client() -> ContentApiClient:
    return ContentApiClient(get_settings().content_api_url)

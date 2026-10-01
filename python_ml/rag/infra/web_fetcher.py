"""Fetch HTML or plain-text webpages over HTTP."""

import httpx

from domain.errors import UpstreamError
from domain.webpage import FetchedWebpage

USER_AGENT = "Mozilla/5.0 (compatible; RAGBot/1.0)"
SUPPORTED_CONTENT_TYPES = ("text/html", "text/plain")


async def fetch_webpage(url: str, timeout: int) -> FetchedWebpage:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            url, headers={"User-Agent": USER_AGENT}, follow_redirects=True
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise UpstreamError(
                error.response.status_code, f"Failed to fetch URL: {error}"
            ) from error

    content_type = response.headers.get("content-type", "")
    if not any(supported in content_type for supported in SUPPORTED_CONTENT_TYPES):
        raise ValueError(f"Content type not supported: {content_type}")

    return FetchedWebpage(
        url=str(response.url), content=response.text, title=response.url.path
    )

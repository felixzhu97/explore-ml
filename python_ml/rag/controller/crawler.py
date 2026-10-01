"""Web crawler API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from rag.domain.webpage import ScrapedWebpage
from rag.service.webpages import WebpageService, get_webpage_service

router = APIRouter(tags=["Crawler"])

WebpageServiceDependency = Annotated[WebpageService, Depends(get_webpage_service)]


class ScrapeRequest(BaseModel):
    url: str
    max_depth: int = Field(default=1, ge=1, le=3)
    include_subpages: bool = False


class ScrapeResponse(BaseModel):
    id: str
    url: str
    title: str
    content_length: int
    chunks_count: int
    status: str

    @classmethod
    def from_webpage(cls, webpage: ScrapedWebpage) -> "ScrapeResponse":
        return cls(
            id=webpage.id,
            url=webpage.url,
            title=webpage.title,
            content_length=webpage.content_length,
            chunks_count=webpage.chunks_count,
            status=webpage.status,
        )


class CrawlRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=50)
    max_depth: int = Field(default=1, ge=1, le=3)


class CrawlResponse(BaseModel):
    total_urls: int
    successful: int
    failed: int
    results: list[ScrapeResponse]


@router.post("/webpages:scrape", response_model=ScrapeResponse)
async def scrape_webpage(
    request: ScrapeRequest, webpage_service: WebpageServiceDependency
) -> ScrapeResponse:
    """Scrape a single URL and index its content."""
    return ScrapeResponse.from_webpage(await webpage_service.scrape(request.url))


@router.post("/webpages:crawl", response_model=CrawlResponse)
async def crawl_webpages(
    request: CrawlRequest, webpage_service: WebpageServiceDependency
) -> CrawlResponse:
    """Crawl multiple URLs in parallel."""
    report = await webpage_service.crawl(request.urls)
    return CrawlResponse(
        total_urls=len(request.urls),
        successful=report.successful,
        failed=report.failed,
        results=[ScrapeResponse.from_webpage(result) for result in report.results],
    )

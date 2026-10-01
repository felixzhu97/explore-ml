"""Scraped webpage value types."""

from dataclasses import dataclass

WEBPAGES_COLLECTION = "webpages"
MAX_WEBPAGE_TEXT_LENGTH = 100_000
MAX_CONCURRENT_CRAWLS = 5


@dataclass(frozen=True)
class FetchedWebpage:
    url: str
    content: str
    title: str


@dataclass(frozen=True)
class ScrapedWebpage:
    id: str
    url: str
    title: str
    content_length: int
    chunks_count: int
    status: str = "completed"

    @property
    def succeeded(self) -> bool:
        return self.status == "completed"

    @classmethod
    def failed(cls, url: str, error: Exception) -> "ScrapedWebpage":
        return cls(
            id="",
            url=url,
            title="",
            content_length=0,
            chunks_count=0,
            status=f"error: {error}",
        )


@dataclass(frozen=True)
class CrawlReport:
    results: list[ScrapedWebpage]

    @property
    def successful(self) -> int:
        return sum(result.succeeded for result in self.results)

    @property
    def failed(self) -> int:
        return len(self.results) - self.successful

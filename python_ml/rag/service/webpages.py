"""Scrape and crawl webpages into the vector store."""

import asyncio
import logging
import time
from functools import lru_cache

from rag.config import get_settings
from rag.domain.chunker import TextChunker, get_chunker
from rag.domain.webpage import (
    MAX_CONCURRENT_CRAWLS,
    MAX_WEBPAGE_TEXT_LENGTH,
    WEBPAGES_COLLECTION,
    CrawlReport,
    ScrapedWebpage,
)
from rag.infra.document_processor import DocumentProcessor, get_document_processor
from rag.infra.pdf_parser import HTMLParser
from rag.infra.web_fetcher import fetch_webpage
from rag.service.indexing import ChunkIndexer, get_chunk_indexer

logger = logging.getLogger(__name__)


class WebpageService:
    def __init__(
        self,
        processor: DocumentProcessor,
        chunker: TextChunker,
        indexer: ChunkIndexer,
        fetch_timeout: int,
    ) -> None:
        self._processor = processor
        self._chunker = chunker
        self._indexer = indexer
        self._fetch_timeout = fetch_timeout

    async def scrape(self, url: str) -> ScrapedWebpage:
        start_time = time.time()
        webpage = await fetch_webpage(url, timeout=self._fetch_timeout)
        processed = await self._processor.process_webpage(
            url=webpage.url, content=webpage.content, title=webpage.title
        )
        document_id = processed["id"]

        full_text = HTMLParser.parse(webpage.content)["text"]
        text = full_text
        if len(text) > MAX_WEBPAGE_TEXT_LENGTH:
            logger.warning(
                "Text too long (%s chars), truncating to %s",
                len(text),
                MAX_WEBPAGE_TEXT_LENGTH,
            )
            text = text[:MAX_WEBPAGE_TEXT_LENGTH]

        metadata = {
            "source_url": webpage.url,
            "title": webpage.title,
            "source_type": "webpage",
            "doc_id": document_id,
            "created_at": "",
        }
        chunks = self._chunker.chunk_text(text, metadata, document_id)
        await self._indexer.index(
            WEBPAGES_COLLECTION,
            chunks,
            lambda _chunk: {
                "doc_id": document_id,
                "source_url": webpage.url,
                "source_type": "webpage",
                "created_at": "",
            },
        )

        logger.info(
            "Scraped '%s' in %.2fms: %s chunks",
            webpage.url,
            (time.time() - start_time) * 1000,
            len(chunks),
        )
        return ScrapedWebpage(
            id=document_id,
            url=webpage.url,
            title=webpage.title,
            content_length=len(full_text),
            chunks_count=len(chunks),
        )

    async def crawl(self, urls: list[str]) -> CrawlReport:
        start_time = time.time()
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_CRAWLS)

        async def scrape_or_report(url: str) -> ScrapedWebpage:
            async with semaphore:
                try:
                    return await self.scrape(url)
                except Exception as error:
                    logger.error("Failed to crawl %s: %s", url, error)
                    return ScrapedWebpage.failed(url, error)

        report = CrawlReport(
            results=list(await asyncio.gather(*(scrape_or_report(url) for url in urls)))
        )
        logger.info(
            "Crawled %s URLs in %.2fms: %s successful, %s failed",
            len(urls),
            (time.time() - start_time) * 1000,
            report.successful,
            report.failed,
        )
        return report


@lru_cache
def get_webpage_service() -> WebpageService:
    return WebpageService(
        get_document_processor(),
        get_chunker(),
        get_chunk_indexer(),
        get_settings().crawler_timeout,
    )

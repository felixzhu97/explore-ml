"""Document processor service."""
import logging
import hashlib
from datetime import UTC, datetime
from pathlib import Path

import aiofiles

from rag.config import get_settings

from rag.domain.chunker import Chunk, get_chunker
from rag.infra.pdf_parser import parse_file

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """
    Service for processing documents and preparing them for embedding.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._chunker = get_chunker()

    async def process_uploaded_file(
        self,
        file_content: bytes,
        filename: str,
        content_type: str,
    ) -> dict:
        """
        Process an uploaded file.

        Args:
            file_content: File bytes
            filename: Original filename
            content_type: MIME type

        Returns:
            Processing result with chunks
        """
        document_id = self._generate_document_id(filename, file_content)

        # Parse the document
        parsed = parse_file(file_content, filename)

        # Extract text based on document type
        if parsed["type"] == "pdf":
            pages = parsed.get("pages", [])
            text_parts = [{"text": page["text"], "page_number": page["page_number"]} for page in pages]
        else:
            text_parts = [{"text": parsed.get("text", ""), "page_number": None}]

        # Create chunks
        metadata = {
            "filename": filename,
            "content_type": content_type,
            "source_type": "document",
            "doc_id": document_id,
            "created_at": datetime.now(UTC).isoformat(),
        }

        chunks = self._chunker.chunk_documents(
            text_parts,
            metadata,
            document_id,
        )

        logger.info(
            f"Processed file '{filename}': {len(chunks)} chunks created"
        )

        return {
            "id": document_id,
            "filename": filename,
            "content_type": content_type,
            "type": parsed["type"],
            "total_text_length": sum(len(part["text"]) for part in text_parts),
            "chunks_count": len(chunks),
            "metadata": parsed.get("metadata", {}),
        }

    async def process_webpage(
        self,
        url: str,
        content: str,
        title: str | None = None,
    ) -> dict:
        """
        Process a webpage.

        Args:
            url: Source URL
            content: HTML content
            title: Page title

        Returns:
            Processing result with chunks
        """
        document_id = self._generate_document_id(url, content.encode())

        # Parse HTML
        from rag.infra.pdf_parser import HTMLParser
        parsed = HTMLParser.parse(content)

        # Chunk the text
        metadata = {
            "source_url": url,
            "title": title or parsed.get("title", ""),
            "source_type": "webpage",
            "doc_id": document_id,
            "created_at": datetime.now(UTC).isoformat(),
        }

        chunks = self._chunker.chunk_text(
            parsed.get("text", ""),
            metadata,
            document_id,
        )

        logger.info(
            f"Processed webpage '{url}': {len(chunks)} chunks created"
        )

        return {
            "id": document_id,
            "url": url,
            "title": title or parsed.get("title", ""),
            "total_text_length": len(parsed.get("text", "")),
            "chunks_count": len(chunks),
            "links_count": len(parsed.get("links", [])),
        }

    async def process_database_content(
        self,
        content: str,
        content_type: str,
        source_id: str,
        metadata: dict | None = None,
    ) -> dict:
        """
        Process content from the database.

        Args:
            content: Text content
            content_type: Type (post, comment, etc.)
            source_id: Source record ID
            metadata: Additional metadata

        Returns:
            Processing result with chunks
        """
        document_id = f"{content_type}_{source_id}"

        chunk_metadata = {
            "source_type": content_type,
            "source_id": source_id,
            "doc_id": document_id,
            "created_at": datetime.now(UTC).isoformat(),
            **(metadata or {}),
        }

        chunks = self._chunker.chunk_text(
            content,
            chunk_metadata,
            document_id,
        )

        logger.info(
            f"Processed {content_type} '{source_id}': {len(chunks)} chunks created"
        )

        return {
            "id": document_id,
            "source_type": content_type,
            "source_id": source_id,
            "content_length": len(content),
            "chunks_count": len(chunks),
        }

    def get_chunks_for_embedding(self, chunks: list[Chunk]) -> list[dict]:
        """
        Get chunks in format ready for embedding.

        Args:
            chunks: List of Chunk objects

        Returns:
            List of chunk dictionaries
        """
        return [
            {
                "id": chunk.id,
                "text": chunk.text,
                "metadata": chunk.metadata,
                "token_count": chunk.token_count,
            }
            for chunk in chunks
        ]

    async def save_upload(
        self,
        file_content: bytes,
        filename: str,
    ) -> Path:
        """
        Save an uploaded file to disk.

        Args:
            file_content: File bytes
            filename: Original filename

        Returns:
            Path to saved file
        """
        settings = get_settings()
        settings.ensure_directories()

        # Generate unique filename
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        document_id = self._generate_document_id(filename, file_content)[:8]
        safe_filename = f"{timestamp}_{document_id}_{filename}"

        file_path = settings.uploads_dir / safe_filename

        async with aiofiles.open(file_path, "wb") as output_file:
            await output_file.write(file_content)

        logger.info(f"Saved file to {file_path}")

        return file_path

    def _generate_document_id(self, identifier: str, content: bytes) -> str:
        """Generate a unique document ID."""
        combined = f"{identifier}_{content[:1024]}"
        return hashlib.sha256(combined.encode()).hexdigest()[:16]


# Singleton instance
_processor: DocumentProcessor | None = None


def get_document_processor() -> DocumentProcessor:
    """Get or create document processor instance."""
    global _processor
    if _processor is None:
        _processor = DocumentProcessor()
    return _processor

"""Upload, list, read and delete indexed documents."""

import logging
import time
from functools import lru_cache

from rag.domain.chunker import TextChunker, get_chunker
from rag.domain.document import (
    DOCUMENTS_COLLECTION,
    DocumentSummary,
    IndexedDocument,
    validate_content,
)
from rag.domain.errors import NotFoundError
from rag.infra.document_processor import DocumentProcessor, get_document_processor
from rag.infra.pdf_parser import parse_file
from rag.infra.qdrant_client import QdrantService, get_qdrant_service
from rag.service.indexing import ChunkIndexer, get_chunk_indexer

logger = logging.getLogger(__name__)

SCAN_VECTOR_SIZE = 768
SCAN_LIMIT = 1000


class DocumentService:
    def __init__(
        self,
        processor: DocumentProcessor,
        chunker: TextChunker,
        indexer: ChunkIndexer,
        qdrant: QdrantService,
    ) -> None:
        self._processor = processor
        self._chunker = chunker
        self._indexer = indexer
        self._qdrant = qdrant

    async def create_document(
        self, filename: str, content_type: str, content: bytes
    ) -> IndexedDocument:
        start_time = time.time()
        validate_content(content)

        processed = await self._processor.process_uploaded_file(
            content, filename, content_type
        )
        document_id = processed["id"]
        created_at = processed["metadata"].get("created_at", "")

        parsed = parse_file(content, filename)
        if parsed["type"] == "pdf":
            text_parts = [
                {"text": page["text"], "page_number": page["page_number"]}
                for page in parsed.get("pages", [])
            ]
        else:
            text_parts = [{"text": parsed.get("text", ""), "page_number": None}]

        metadata = {
            "filename": filename,
            "content_type": content_type,
            "source_type": "document",
            "doc_id": document_id,
            "created_at": created_at,
        }
        chunks = self._chunker.chunk_documents(text_parts, metadata, document_id)
        await self._indexer.index(
            DOCUMENTS_COLLECTION,
            chunks,
            lambda chunk: {
                "doc_id": document_id,
                "filename": filename,
                "source_type": "document",
                "created_at": created_at,
                "page": chunk.metadata.get("page"),
            },
        )

        logger.info(
            "Document '%s' processed in %.2fms: %s chunks",
            filename,
            (time.time() - start_time) * 1000,
            len(chunks),
        )
        return IndexedDocument(
            id=document_id,
            filename=filename,
            content_type=content_type,
            file_size=len(content),
            chunks_count=len(chunks),
        )

    async def list_documents(self) -> list[DocumentSummary]:
        chunk_counts: dict[str, int] = {}
        filenames: dict[str, str | None] = {}
        for record in await self._scan_chunks():
            payload = record.get("payload", {})
            document_id = payload.get("doc_id")
            if not document_id:
                continue
            filenames.setdefault(document_id, payload.get("filename"))
            chunk_counts[document_id] = chunk_counts.get(document_id, 0) + 1
        return [
            DocumentSummary(
                id=document_id,
                filename=filenames[document_id],
                content_type="",
                chunks_count=count,
            )
            for document_id, count in chunk_counts.items()
        ]

    async def get_document(self, document_id: str) -> DocumentSummary:
        chunks = await self._document_chunks(document_id)
        first_payload = chunks[0]["payload"]
        return DocumentSummary(
            id=document_id,
            filename=first_payload.get("filename"),
            content_type=first_payload.get("content_type", ""),
            chunks_count=len(chunks),
        )

    async def delete_document(self, document_id: str) -> None:
        chunks = await self._document_chunks(document_id)
        point_ids = [chunk["id"] for chunk in chunks]
        await self._qdrant.delete_points(DOCUMENTS_COLLECTION, point_ids)
        logger.info("Deleted document '%s' with %s chunks", document_id, len(point_ids))

    async def _document_chunks(self, document_id: str) -> list[dict]:
        chunks = [
            record
            for record in await self._scan_chunks()
            if record["payload"].get("doc_id") == document_id
        ]
        if not chunks:
            raise NotFoundError("Document not found")
        return chunks

    async def _scan_chunks(self) -> list[dict]:
        return await self._qdrant.search(
            collection=DOCUMENTS_COLLECTION,
            query_vector=[0] * SCAN_VECTOR_SIZE,
            top_k=SCAN_LIMIT,
        )


@lru_cache
def get_document_service() -> DocumentService:
    return DocumentService(
        get_document_processor(),
        get_chunker(),
        get_chunk_indexer(),
        get_qdrant_service(),
    )

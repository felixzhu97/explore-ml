"""Document management API routes (AIP REST)."""

import base64
import binascii
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel

from rag.domain.document import DEFAULT_CONTENT_TYPE, DocumentSummary, validate_filename
from rag.service.documents import DocumentService, get_document_service

router = APIRouter(prefix="/documents", tags=["Documents"])

DocumentServiceDependency = Annotated[DocumentService, Depends(get_document_service)]

DEFAULT_PAGE_SIZE = 20


class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    file_size: int
    content_type: str
    status: str = "completed"
    chunks_count: int = 0


class DocumentInfo(BaseModel):
    id: str
    filename: str | None = None
    source_url: str | None = None
    content_type: str
    file_size: int = 0
    status: str = "indexed"
    chunks_count: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_summary(cls, summary: DocumentSummary) -> "DocumentInfo":
        return cls(
            id=summary.id,
            filename=summary.filename,
            content_type=summary.content_type,
            chunks_count=summary.chunks_count,
        )


class DocumentListResponse(BaseModel):
    documents: list[DocumentInfo]
    next_page_token: str | None = None


def _decode_offset(page_token: str | None) -> int:
    if not page_token:
        return 0
    try:
        padded = page_token + "=" * (-len(page_token) % 4)
        return max(0, int(base64.urlsafe_b64decode(padded).decode("ascii")))
    except (binascii.Error, UnicodeDecodeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Invalid page_token") from error


def _encode_offset(offset: int) -> str:
    return base64.urlsafe_b64encode(str(offset).encode("ascii")).decode("ascii").rstrip("=")


@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    file: Annotated[UploadFile, File(description="Document to upload")],
    document_service: DocumentServiceDependency,
) -> DocumentUploadResponse:
    """Create (upload and index) a document. Supports PDF, HTML, Markdown, DOCX, TXT."""
    filename = validate_filename(file.filename)
    document = await document_service.create_document(
        filename, file.content_type or DEFAULT_CONTENT_TYPE, await file.read()
    )
    return DocumentUploadResponse(
        id=document.id,
        filename=document.filename,
        file_size=document.file_size,
        content_type=document.content_type,
        chunks_count=document.chunks_count,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    document_service: DocumentServiceDependency,
    page_size: Annotated[int | None, Query(ge=1, le=100)] = None,
    page_token: Annotated[str | None, Query()] = None,
) -> DocumentListResponse:
    """List uploaded documents (AIP-158 pagination)."""
    size = page_size or DEFAULT_PAGE_SIZE
    offset = _decode_offset(page_token)
    documents = await document_service.list_documents()
    has_more = offset + size < len(documents)
    return DocumentListResponse(
        documents=[DocumentInfo.from_summary(item) for item in documents[offset : offset + size]],
        next_page_token=_encode_offset(offset + size) if has_more else None,
    )


@router.get("/{document_id}", response_model=DocumentInfo)
async def get_document(
    document_id: str, document_service: DocumentServiceDependency
) -> DocumentInfo:
    """Get document details by ID."""
    return DocumentInfo.from_summary(await document_service.get_document(document_id))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str, document_service: DocumentServiceDependency
) -> Response:
    """Delete a document and all its chunks (AIP-135)."""
    await document_service.delete_document(document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

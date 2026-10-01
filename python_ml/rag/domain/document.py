"""Uploaded document rules and value types."""

from dataclasses import dataclass

from rag.domain.errors import InvalidRequestError

DOCUMENTS_COLLECTION = "documents"
ALLOWED_EXTENSIONS = (".pdf", ".html", ".htm", ".md", ".txt", ".docx", ".doc")
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
DEFAULT_CONTENT_TYPE = "application/octet-stream"


@dataclass(frozen=True)
class IndexedDocument:
    id: str
    filename: str
    content_type: str
    file_size: int
    chunks_count: int


@dataclass(frozen=True)
class DocumentSummary:
    id: str
    filename: str | None
    content_type: str
    chunks_count: int


def validate_filename(filename: str | None) -> str:
    if not filename:
        raise InvalidRequestError("No filename provided")
    extension = "." + filename.lower().rsplit(".", 1)[-1]
    if extension not in ALLOWED_EXTENSIONS:
        raise InvalidRequestError(
            f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    return filename


def validate_content(content: bytes) -> None:
    if not content:
        raise InvalidRequestError("Empty file")
    if len(content) > MAX_UPLOAD_BYTES:
        raise InvalidRequestError("File too large (max 50MB)")

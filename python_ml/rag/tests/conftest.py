"""Test configuration and fixtures."""
import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def mock_qdrant():
    """Mock Qdrant service."""
    qdrant = AsyncMock()
    qdrant.health_check = AsyncMock(return_value=True)
    qdrant.initialize_collections = AsyncMock()
    qdrant.upsert = AsyncMock(return_value={"status": "completed", "points_count": 5})
    qdrant.search = AsyncMock(return_value=[
        {
            "id": "chunk_1",
            "score": 0.95,
            "payload": {
                "text": "Test document content",
                "source_type": "document",
                "doc_id": "doc_123",
            }
        }
    ])
    qdrant.delete_points = AsyncMock(return_value={"status": "completed", "deleted_count": 5})
    qdrant.get_collections = AsyncMock(return_value=["documents", "posts", "comments"])
    qdrant.get_collection_info = AsyncMock(return_value={
        "name": "documents",
        "vectors_count": 100,
        "points_count": 100,
        "status": "green",
        "vector_size": 768,
        "distance": "Cosine",
    })
    return qdrant


@pytest.fixture
def mock_embeddings():
    """Mock embedding service."""
    embeddings = AsyncMock()
    embeddings.embed = AsyncMock(return_value=[
        [0.1] * 768 for _ in range(5)
    ])
    embeddings.embed_single = AsyncMock(return_value=[0.1] * 768)
    embeddings.health_check = AsyncMock(return_value=True)
    return embeddings


@pytest.fixture
def sample_pdf_bytes():
    """Sample PDF content (minimal valid PDF)."""
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"


@pytest.fixture
def sample_text_content():
    """Sample text content."""
    return """
    This is a sample document for testing.

    It contains multiple paragraphs of text that will be chunked
    into smaller pieces for embedding and retrieval.

    The RAG service should be able to process this text and create
    meaningful chunks that capture the semantic meaning.
    """


@pytest.fixture
def sample_html_content():
    """Sample HTML content."""
    return """
    <html>
    <head><title>Test Page</title></head>
    <body>
        <h1>Test Document</h1>
        <p>This is a test paragraph with some content.</p>
        <p>Another paragraph with more information.</p>
        <nav><a href="/link1">Link 1</a></nav>
    </body>
    </html>
    """

"""HTTP behaviour of the RAG services through the FastAPI app."""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from rag.domain.chunker import get_chunker
from rag.domain.errors import ServiceUnavailableError, UpstreamError
from rag.service.documents import DocumentService, get_document_service
from rag.service.query import QueryService, get_query_service
from rag.service.sync import SyncService, get_sync_service
import rag.module
from server import build_app

app = build_app({"rag": rag.module})
rag.module.register_exception_handlers(app)


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def no_rerank(monkeypatch):
    monkeypatch.setattr("rag.service.query.rerank_documents", AsyncMock(return_value=None))


def _query_service(mock_qdrant, mock_embeddings, llm) -> QueryService:
    return QueryService(embeddings=mock_embeddings, qdrant=mock_qdrant, llm=llm)


def test_should_return_404_detail_when_document_is_missing(client, mock_qdrant):
    service = DocumentService(AsyncMock(), get_chunker(), AsyncMock(), mock_qdrant)
    app.dependency_overrides[get_document_service] = lambda: service

    response = client.get("/api/v1/documents/unknown")

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found"}


def test_should_reject_unsupported_file_type_with_400(client):
    response = client.post(
        "/api/v1/documents", files={"file": ("notes.exe", b"binary", "application/octet-stream")}
    )

    assert response.status_code == 400
    assert response.json()["detail"].startswith("Unsupported file type")


def test_should_answer_with_sources_when_chunks_are_found(
    client, mock_qdrant, mock_embeddings, no_rerank
):
    llm = AsyncMock()
    llm.complete = AsyncMock(return_value="Generated answer")
    service = _query_service(mock_qdrant, mock_embeddings, llm)
    app.dependency_overrides[get_query_service] = lambda: service

    response = client.post(
        "/api/v1/documents:query", json={"query": "what?", "collection": "documents"}
    )

    body = response.json()
    assert response.status_code == 200
    assert body["answer"] == "Generated answer"
    assert body["sources"][0]["id"] == "chunk_1"
    assert body["total_chunks_searched"] == 1
    assert body["collection_used"] == "documents"


def test_should_return_503_when_llm_is_unavailable(
    client, mock_qdrant, mock_embeddings, no_rerank
):
    llm = AsyncMock()
    llm.complete = AsyncMock(side_effect=ServiceUnavailableError("LLM service unavailable"))
    app.dependency_overrides[get_query_service] = lambda: _query_service(
        mock_qdrant, mock_embeddings, llm
    )

    response = client.post("/api/v1/documents:query", json={"query": "what?"})

    assert response.status_code == 503
    assert response.json() == {"detail": "LLM service unavailable"}


def test_should_stream_no_results_message_then_done_when_nothing_matches(
    client, mock_qdrant, mock_embeddings, no_rerank
):
    mock_qdrant.search = AsyncMock(return_value=[])
    app.dependency_overrides[get_query_service] = lambda: _query_service(
        mock_qdrant, mock_embeddings, AsyncMock()
    )

    response = client.post("/api/v1/documents:streamQuery", json={"query": "what?"})

    assert response.text == (
        "data: No relevant documents found for your query.\n\ndata: [DONE]\n\n"
    )


def test_should_count_synced_and_skipped_comments(client, mock_qdrant, mock_embeddings):
    content_api = AsyncMock()
    content_api.list_records = AsyncMock(
        return_value=[{"id": "c1", "content": "Nice post"}, {"id": "c2", "content": ""}]
    )
    indexer = AsyncMock()
    service = SyncService(get_chunker(), indexer, content_api)
    app.dependency_overrides[get_sync_service] = lambda: service

    response = client.post("/api/v1/comments:sync", json={})

    body = response.json()
    assert (body["total"], body["successful"], body["skipped"]) == (2, 1, 1)
    assert indexer.index.await_args.args[0] == "comments"


def test_should_forward_upstream_status_when_content_api_fails(client):
    content_api = AsyncMock()
    content_api.list_records = AsyncMock(
        side_effect=UpstreamError(502, "Failed to fetch posts from database: bad gateway")
    )
    app.dependency_overrides[get_sync_service] = lambda: SyncService(
        get_chunker(), AsyncMock(), content_api
    )

    response = client.post("/api/v1/posts:sync")

    assert response.status_code == 502
    assert response.json()["detail"].startswith("Failed to fetch posts")

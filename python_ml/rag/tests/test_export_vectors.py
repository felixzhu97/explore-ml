"""Tests for POST /api/v1/documents:exportVectors."""
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from service import rag as rag_service
from controller.query import router as query_router


def _record(i: int, collection: str, text: str = "chunk") -> dict:
    return {
        "id": f"{collection}-{i}",
        "vector": [0.1 * i, 0.2, 0.3],
        "payload": {"text": text, "filename": f"f{i}.md"},
    }


@pytest.fixture
def qdrant():
    q = AsyncMock()
    q.get_collections = AsyncMock(return_value=["documents", "posts"])
    q.scroll_vectors = AsyncMock(
        side_effect=lambda name, limit: [_record(i, name) for i in range(min(limit, 3))]
    )
    return q


@pytest.fixture
def client(qdrant):
    app = FastAPI()
    app.include_router(query_router, prefix="/api/v1")
    app.dependency_overrides[rag_service.get_qdrant] = lambda: qdrant
    return TestClient(app)


def test_should_export_points_from_all_collections_when_none_given(client, qdrant):
    res = client.post("/api/v1/documents:exportVectors", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["dimension"] == 3
    assert len(body["points"]) == 6
    assert {p["metadata"]["collection"] for p in body["points"]} == {"documents", "posts"}
    point = body["points"][0]
    assert point["text"] == "chunk"
    assert "text" not in point["metadata"]
    assert point["metadata"]["filename"] == "f0.md"


def test_should_stop_at_limit_across_collections(client, qdrant):
    res = client.post("/api/v1/documents:exportVectors", json={"limit": 4})
    assert len(res.json()["points"]) == 4
    assert qdrant.scroll_vectors.await_args_list[1].args == ("posts", 1)


def test_should_export_only_the_requested_collection(client, qdrant):
    res = client.post("/api/v1/documents:exportVectors", json={"collection": "posts"})
    assert {p["metadata"]["collection"] for p in res.json()["points"]} == {"posts"}
    qdrant.get_collections.assert_not_awaited()


def test_should_truncate_text_to_500_chars(client, qdrant):
    qdrant.scroll_vectors.side_effect = lambda name, limit: [_record(0, name, "x" * 900)]
    res = client.post("/api/v1/documents:exportVectors", json={"collection": "documents"})
    assert len(res.json()["points"][0]["text"]) == 500


def test_should_report_zero_dimension_when_empty(client, qdrant):
    qdrant.scroll_vectors.side_effect = lambda name, limit: []
    res = client.post("/api/v1/documents:exportVectors", json={})
    assert res.json() == {"dimension": 0, "points": []}


@pytest.mark.parametrize("limit", [0, 10001])
def test_should_reject_limits_outside_1_to_10000(client, limit):
    res = client.post("/api/v1/documents:exportVectors", json={"limit": limit})
    assert res.status_code == 422

"""Retrieval-augmented answer rules and value types."""

from dataclasses import dataclass
from typing import Any

SEARCHABLE_COLLECTIONS = ("documents", "posts", "comments", "webpages")
NO_RESULTS_ANSWER = "No relevant documents found for your query."
SOURCE_TEXT_LIMIT = 500
RERANK_CANDIDATE_FACTOR = 3


@dataclass(frozen=True)
class SearchHit:
    id: str
    score: float
    payload: dict[str, Any]

    @property
    def text(self) -> str:
        return str(self.payload.get("text", ""))

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> "SearchHit":
        return cls(id=record["id"], score=record["score"], payload=record["payload"])


@dataclass(frozen=True)
class Answer:
    text: str
    sources: list[SearchHit]
    total_chunks_searched: int
    generation_time_ms: int


@dataclass(frozen=True)
class ExportedPoint:
    id: str
    vector: list[float]
    text: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class ExportedVectors:
    points: list[ExportedPoint]

    @property
    def dimension(self) -> int:
        return len(self.points[0].vector) if self.points else 0


def build_system_prompt(context_texts: list[str]) -> str:
    context = "\n\n".join(
        f"[Source {index}]: {text[:SOURCE_TEXT_LIMIT]}..."
        if len(text) > SOURCE_TEXT_LIMIT
        else f"[Source {index}]: {text}"
        for index, text in enumerate(context_texts, start=1)
    )
    return f"""You are a helpful assistant that answers questions based on the provided context.

Context:
{context}

Instructions:
1. Answer the question based ONLY on the provided context.
2. If the context doesn't contain enough information to answer the question, say so.
3. Cite your sources using [Source N] notation when referencing specific information.
4. Be concise but thorough.
5. If you're uncertain, acknowledge the uncertainty.
"""

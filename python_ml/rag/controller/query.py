"""RAG query API routes."""

from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rag.domain.query import SOURCE_TEXT_LIMIT, SearchHit
from rag.service.query import QueryService, get_query_service

router = APIRouter(tags=["Query"])

QueryServiceDependency = Annotated[QueryService, Depends(get_query_service)]


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    collection: str | None = Field(
        default=None,
        description="Collection to search in. If None, searches all collections.",
    )
    top_k: int = Field(default=5, ge=1, le=20)
    include_sources: bool = Field(
        default=True, description="Whether to include source documents in the response."
    )
    filter_metadata: dict | None = Field(
        default=None, description="Metadata filters for the query."
    )
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0, description="Temperature for LLM response generation."
    )
    stream: bool = Field(default=False, description="Whether to stream the response.")


class SourceDocument(BaseModel):
    id: str
    text: str
    score: float
    metadata: dict

    @classmethod
    def from_hit(cls, hit: SearchHit) -> "SourceDocument":
        return cls(
            id=hit.id, text=hit.text[:SOURCE_TEXT_LIMIT], score=hit.score, metadata=hit.payload
        )


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceDocument]
    query: str
    collection_used: str | None = None
    total_chunks_searched: int = 0
    generation_time_ms: int = 0


class ExportVectorsRequest(BaseModel):
    collection: str | None = Field(
        default=None,
        description="Collection to export. If None, exports from all collections.",
    )
    limit: int = Field(default=2000, ge=1, le=10000)


class ExportedPointResponse(BaseModel):
    id: str
    vector: list[float]
    text: str
    metadata: dict


class ExportVectorsResponse(BaseModel):
    """Exported vectors; `dimension` is 0 when nothing is stored."""

    dimension: int
    points: list[ExportedPointResponse]


@router.post("/documents:query", response_model=QueryResponse)
async def query_documents(
    request: QueryRequest, query_service: QueryServiceDependency
) -> QueryResponse:
    """Query the RAG system with a question."""
    answer = await query_service.answer(
        request.query, request.collection, request.top_k, request.include_sources
    )
    return QueryResponse(
        answer=answer.text,
        sources=[SourceDocument.from_hit(hit) for hit in answer.sources],
        query=request.query,
        collection_used=request.collection,
        total_chunks_searched=answer.total_chunks_searched,
        generation_time_ms=answer.generation_time_ms,
    )


@router.post("/documents:streamQuery")
async def stream_query_documents(
    request: QueryRequest, query_service: QueryServiceDependency
) -> StreamingResponse:
    """Query the RAG system with a server-sent events response."""
    tokens = await query_service.stream_answer(
        request.query, request.collection, request.top_k
    )

    async def server_sent_events() -> AsyncIterator[str]:
        async for token in tokens:
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        server_sent_events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/documents:exportVectors", response_model=ExportVectorsResponse)
async def export_vectors(
    request: ExportVectorsRequest, query_service: QueryServiceDependency
) -> ExportVectorsResponse:
    """Export stored chunk vectors (text truncated to 500 chars) for the UI atlas."""
    exported = await query_service.export_vectors(request.collection, request.limit)
    return ExportVectorsResponse(
        dimension=exported.dimension,
        points=[
            ExportedPointResponse(
                id=point.id, vector=point.vector, text=point.text, metadata=point.metadata
            )
            for point in exported.points
        ],
    )


@router.get("/collections")
async def list_collections(query_service: QueryServiceDependency) -> dict[str, Any]:
    """List all available collections."""
    return {"collections": await query_service.list_collections()}

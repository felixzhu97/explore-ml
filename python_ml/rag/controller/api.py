"""HTTP routes for RAG (resource routers under /api/v1)."""

from fastapi import APIRouter

from rag.controller.crawler import router as crawler_router
from rag.controller.documents import router as documents_router
from rag.controller.query import router as query_router
from rag.controller.sync import router as sync_router

router = APIRouter()
router.include_router(documents_router, prefix="/api/v1")
router.include_router(crawler_router, prefix="/api/v1")
router.include_router(sync_router, prefix="/api/v1")
router.include_router(query_router, prefix="/api/v1")

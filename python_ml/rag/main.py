"""RAG FastAPI entrypoint — uvicorn main:app."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from controller.api import router
from controller.errors import register_exception_handlers
from service.health import get_health_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Starting RAG Service...")
    settings = get_settings()
    settings.ensure_directories()
    await get_health_service().startup()
    logger.info("RAG Service started successfully")
    yield
    logger.info("Shutting down RAG Service...")


app = FastAPI(
    title="RAG Service",
    description="Retrieval Augmented Generation service for WhatsFeed",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    logger.info(
        "%s %s - %s - %.3fs",
        request.method,
        request.url.path,
        response.status_code,
        time.time() - start_time,
    )
    return response


register_exception_handlers(app)
app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else settings.workers,
    )

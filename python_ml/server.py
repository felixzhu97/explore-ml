"""Builds the single Explore ML FastAPI app from the enabled modules.

Each module package exposes `module.py` with a `router` and, optionally,
`lifespan()`, `health()`, `readiness()` and `register_exception_handlers(app)`.
"""

import importlib
import logging
import time
from collections.abc import Iterable, Mapping
from contextlib import AsyncExitStack, asynccontextmanager
from types import ModuleType
from typing import Any

from fastapi import APIRouter, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.responses import Response

MODULE_NAMES = ("recommendation", "vision", "rag", "image_playground", "speech", "video")
SERVICE_NAME = "Explore ML"
SERVICE_VERSION = "1.0.0"

logger = logging.getLogger("explore_ml")


def load_modules(names: Iterable[str]) -> dict[str, ModuleType]:
    return {name: importlib.import_module(f"{name}.module") for name in names}


async def check_module(module: Any) -> dict[str, Any]:
    started_at = time.perf_counter()
    check = getattr(module, "health", None)
    try:
        report = dict(await check()) if check else {"status": "ok"}
    except Exception as error:
        report = {"status": "error", "detail": str(error)}
    report.setdefault("status", "ok")
    report["latency_ms"] = round((time.perf_counter() - started_at) * 1000, 2)
    return report


def health_router(modules: Mapping[str, Any]) -> APIRouter:
    router = APIRouter(tags=["Health"])

    @router.get("/health")
    async def health() -> dict[str, Any]:
        reports = {name: await check_module(module) for name, module in modules.items()}
        healthy = all(report["status"] == "ok" for report in reports.values())
        return {"status": "ok" if healthy else "degraded", "modules": reports}

    @router.get("/health/live")
    async def liveness() -> dict[str, str]:
        return {"status": "alive"}

    @router.get("/health/ready")
    async def readiness() -> JSONResponse:
        reasons: dict[str, str] = {}
        for name, module in modules.items():
            check = getattr(module, "readiness", None)
            if check is None:
                continue
            ready, reason = await check()
            if not ready:
                reasons[name] = reason or "not ready"
        if reasons:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "not ready", "modules": reasons},
            )
        return JSONResponse(content={"status": "ready"})

    @router.get("/metrics", tags=["Monitoring"])
    async def metrics() -> Response:
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @router.get("/", tags=["Root"])
    async def root() -> dict[str, Any]:
        return {
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "modules": list(modules),
            "docs": "/docs",
            "health": "/health",
        }

    return router


def build_app(modules: Mapping[str, Any]) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        async with AsyncExitStack() as stack:
            for name, module in modules.items():
                module_lifespan = getattr(module, "lifespan", None)
                if module_lifespan is not None:
                    logger.info("Starting module %s", name)
                    await stack.enter_async_context(module_lifespan())
            yield

    app = FastAPI(title=SERVICE_NAME, version=SERVICE_VERSION, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started_at = time.perf_counter()
        response = await call_next(request)
        logger.info(
            "%s %s - %s - %.3fs",
            request.method,
            request.url.path,
            response.status_code,
            time.perf_counter() - started_at,
        )
        return response

    app.include_router(health_router(modules))
    for module in modules.values():
        register_exception_handlers = getattr(module, "register_exception_handlers", None)
        if register_exception_handlers is not None:
            register_exception_handlers(app)
        app.include_router(module.router)
    return app


def create_app(module_names: Iterable[str] = MODULE_NAMES) -> FastAPI:
    return build_app(load_modules(module_names))

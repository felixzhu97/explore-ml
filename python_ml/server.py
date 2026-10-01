"""Builds the Explore ML app from module packages.

Each module exposes `router` and `health()`, and optionally `lifespan()`.
"""

import time
from contextlib import AsyncExitStack, asynccontextmanager
from types import ModuleType

from fastapi import FastAPI


def build_app(modules: dict[str, ModuleType]) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        async with AsyncExitStack() as stack:
            for module in modules.values():
                if hasattr(module, "lifespan"):
                    await stack.enter_async_context(module.lifespan())
            yield

    app = FastAPI(title="Explore ML", lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict:
        reports = {}
        for name, module in modules.items():
            started_at = time.perf_counter()
            reports[name] = await module.health()
            reports[name]["latency_ms"] = round((time.perf_counter() - started_at) * 1000, 2)
        healthy = all(report["status"] == "ok" for report in reports.values())
        return {"status": "ok" if healthy else "degraded", "modules": reports}

    for module in modules.values():
        app.include_router(module.router)
    return app

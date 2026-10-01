"""The single Explore ML app: module composition and aggregated health."""

from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from server import build_app


def fake_module(name: str, *, status: str = "ok", events: list | None = None):
    router = APIRouter()

    @router.get(f"/api/v1/{name}s:ping")
    async def ping() -> dict[str, str]:
        return {"module": name}

    async def health() -> dict:
        return {"status": status}

    @asynccontextmanager
    async def lifespan():
        if events is not None:
            events.append(f"start {name}")
        yield
        if events is not None:
            events.append(f"stop {name}")

    return SimpleNamespace(router=router, health=health, lifespan=lifespan)


def test_should_serve_every_module_route_on_one_app():
    client = TestClient(build_app({"alpha": fake_module("alpha"), "beta": fake_module("beta")}))

    assert client.get("/api/v1/alphas:ping").json() == {"module": "alpha"}
    assert client.get("/api/v1/betas:ping").json() == {"module": "beta"}


def test_should_report_ok_when_every_module_is_healthy():
    client = TestClient(build_app({"alpha": fake_module("alpha"), "beta": fake_module("beta")}))

    body = client.get("/health").json()

    assert body["status"] == "ok"
    assert set(body["modules"]) == {"alpha", "beta"}
    assert body["modules"]["alpha"]["status"] == "ok"
    assert body["modules"]["alpha"]["latency_ms"] >= 0


def test_should_report_degraded_when_one_module_is_unhealthy():
    client = TestClient(
        build_app({"alpha": fake_module("alpha"), "beta": fake_module("beta", status="degraded")})
    )

    assert client.get("/health").json()["status"] == "degraded"


def test_should_start_modules_in_order_and_stop_them_in_reverse():
    events: list[str] = []
    app = build_app(
        {"alpha": fake_module("alpha", events=events), "beta": fake_module("beta", events=events)}
    )

    with TestClient(app):
        assert events == ["start alpha", "start beta"]

    assert events == ["start alpha", "start beta", "stop beta", "stop alpha"]


def test_should_start_modules_without_a_lifespan():
    module = fake_module("alpha")
    del module.lifespan

    with TestClient(build_app({"alpha": module})) as client:
        assert client.get("/health").json()["status"] == "ok"


def operations(app) -> set[tuple[str, str]]:
    return {
        (method.upper(), path)
        for path, item in app.openapi()["paths"].items()
        for method in item
    }


def test_should_not_register_the_same_operation_in_two_modules():
    try:
        import main
    except ImportError as error:
        pytest.skip(f"not every module's dependencies are installed: {error}")
    modules = {
        name: getattr(main, name).module
        for name in ("recommendation", "vision", "rag", "image_playground", "speech", "video")
    }
    shared = operations(build_app({}))
    owners: dict[tuple[str, str], str] = {}
    for name, module in modules.items():
        for operation in operations(build_app({name: module})) - shared:
            assert operation not in owners, f"{operation} in {owners.get(operation)} and {name}"
            owners[operation] = name

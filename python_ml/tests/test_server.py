"""The single Explore ML app: module composition and aggregated health."""

from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from server import MODULE_NAMES, build_app, create_app, load_modules


def fake_module(name: str, *, status: str = "ok", ready: bool = True, events: list | None = None):
    router = APIRouter()

    @router.get(f"/api/v1/{name}s:ping")
    async def ping() -> dict[str, str]:
        return {"module": name}

    async def health() -> dict:
        return {"status": status}

    async def readiness() -> tuple[bool, str | None]:
        return ready, None if ready else f"{name} down"

    @asynccontextmanager
    async def lifespan():
        if events is not None:
            events.append(f"start {name}")
        yield
        if events is not None:
            events.append(f"stop {name}")

    return SimpleNamespace(router=router, health=health, readiness=readiness, lifespan=lifespan)


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


def test_should_report_error_when_a_module_health_check_raises():
    broken = fake_module("alpha")

    async def health() -> dict:
        raise RuntimeError("boom")

    broken.health = health
    body = TestClient(build_app({"alpha": broken})).get("/health").json()

    assert body["modules"]["alpha"] == {
        "status": "error",
        "detail": "boom",
        "latency_ms": body["modules"]["alpha"]["latency_ms"],
    }


def test_should_treat_a_module_without_health_check_as_ok():
    module = SimpleNamespace(router=APIRouter())

    body = TestClient(build_app({"alpha": module})).get("/health").json()

    assert body["modules"]["alpha"]["status"] == "ok"


def test_should_return_503_with_reasons_when_a_module_is_not_ready():
    client = TestClient(
        build_app({"alpha": fake_module("alpha"), "beta": fake_module("beta", ready=False)})
    )

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not ready", "modules": {"beta": "beta down"}}


def test_should_be_ready_when_every_module_is_ready():
    response = TestClient(build_app({"alpha": fake_module("alpha")})).get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_should_start_modules_in_order_and_stop_them_in_reverse():
    events: list[str] = []
    app = build_app(
        {"alpha": fake_module("alpha", events=events), "beta": fake_module("beta", events=events)}
    )

    with TestClient(app):
        assert events == ["start alpha", "start beta"]

    assert events == ["start alpha", "start beta", "stop beta", "stop alpha"]


def test_should_list_modules_on_the_root_route():
    body = TestClient(build_app({"alpha": fake_module("alpha")})).get("/").json()

    assert body["modules"] == ["alpha"]
    assert body["health"] == "/health"


def operations(app) -> set[tuple[str, str]]:
    return {
        (method.upper(), path)
        for path, item in app.openapi()["paths"].items()
        for method in item
    }


def test_should_mount_only_the_requested_modules():
    paths = {path for _, path in operations(create_app(["rag"]))}

    assert "/api/v1/documents:query" in paths
    assert "/api/v1/images:generate" not in paths


def test_should_not_register_the_same_operation_in_two_modules():
    try:
        modules = load_modules(MODULE_NAMES)
    except ImportError as error:
        pytest.skip(f"not every module's dependencies are installed: {error}")
    shared = operations(build_app({}))
    owners: dict[tuple[str, str], str] = {}
    for name, module in modules.items():
        for operation in operations(build_app({name: module})) - shared:
            assert operation not in owners, f"{operation} in {owners.get(operation)} and {name}"
            owners[operation] = name

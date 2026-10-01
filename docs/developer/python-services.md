# Python ML modules — one app, identical package layout

Explore ML runs six optional Python modules under `python_ml/` as one FastAPI
app on port `8000`. Sibling product clients call their **API only**; that API
calls this app over loopback.

Every module is a package with the **same top-level directory** and the same
basic DDD layers: `controller` → `service` → `domain` ← `infra`. Each layer is
one folder of flat files (no sub-folders inside a layer).

## App layout

```
python_ml/
├── README.md
├── .env.example          # every module's variables, one file
├── requirements.txt      # -r each module's requirements.txt
├── overrides.txt         # uv override: transformers==4.57.6
├── Dockerfile            # one image, port 8000
├── pytest.ini            # pythonpath = ., testpaths = tests
├── config.py             # loads .env; HOST, PORT, EXPLORE_MODULES
├── server.py             # load_modules, aggregated health, build_app
├── main.py               # app = create_app(); uvicorn on HOST:PORT
├── tests/                # app tests (server, config)
└── <module>/             # recommendation, vision, rag, image_playground,
                          # speech, video
```

## Module layout

```
python_ml/<module>/
├── README.md
├── __init__.py
├── module.py             # the contract the app loads (below)
├── requirements.txt      # serving dependencies
├── requirements-train.txt # training extras (all but video)
├── config.py             # os.getenv; .env is already loaded by the app
├── controller/           # FastAPI routers + inline Pydantic DTOs
├── service/              # XService classes, orchestration only
├── domain/               # dataclasses, enums, errors, pure rules
├── infra/                # model loading, clients, ETL, codecs
├── tests/                # pytest suite
├── training/             # fine-tuning / eval scripts (all but video)
└── (recommendation only) celery_app.py, tasks.py, run_*.py,
    requirements-optional.txt (LightFM)
```

Runtime dirs (`<module>/output/`, `rag/uploads/`, `rag/data/qdrant`) are
never committed. Repo-level fixtures: `data/` (sibling of `python_ml/`).

Imports are absolute from `python_ml/`: `from rag.service.query import …`,
`from vision import config`. Run scripts as modules from `python_ml/`, for
example `python -m recommendation.run_jobs --job explore`.

## Module contract

`server.py` imports `<module>.module` for each name in `EXPLORE_MODULES`
(default: all six, in a fixed order) and reads:

| Attribute | Required | Purpose |
| --------- | -------- | ------- |
| `router` | yes | `APIRouter` with the module's `/api/v1/...` routes |
| `lifespan()` | no | Async context manager for startup and shutdown work, e.g. `get_video_service().startup()` |
| `async health() -> dict` | no | Entry under `modules.<name>` in `GET /health`; must include `status` (`ok`, `degraded` or `error`) |
| `async readiness() -> (bool, reason)` | no | Feeds `GET /health/ready` |
| `register_exception_handlers(app)` | no | Domain error mapping (RAG) |

Lifespans enter in module order and exit in reverse. The app measures each
`health()` call and adds `latency_ms`; an exception becomes
`{status: "error", detail}`.

## Start

```bash
cd python_ml
uvicorn main:app --port 8000      # or: python main.py (HOST / PORT)
EXPLORE_MODULES=rag,vision uvicorn main:app --port 8000
```

| Path | Response |
| ---- | -------- |
| `GET /health` | `{status: ok \| degraded, modules: {name: {status, latency_ms, …}}}` |
| `GET /health/live` | `{status: "alive"}` |
| `GET /health/ready` | `{status: "ready"}`, or 503 `{status: "not ready", modules: {name: reason}}` |
| `GET /metrics` | Prometheus metrics |
| `GET /` | App name, modules and links |

The UI dev server proxies `/ml/*` to this app (`EXPLORE_ML_URL` overrides the
target).

## Routes

All modules share one flat namespace, `/api/v1/<collection>:<method>`, with no
module prefix ([AIP-136](https://google.aip.dev/136)). Collections are unique
across modules, so two modules never register the same operation; a test in
`tests/test_server.py` checks this through the OpenAPI document. Media files
use distinct roots: `/output/image/`, `/output/voice/`, `/output/video/`.

## Layering

- **controller/** — routers plus inline Pydantic request/response models;
  inject the service with
  `XServiceDependency = Annotated[XService, Depends(get_x_service)]`
- **service/** — one `XService` class per use case, built by an
  `@lru_cache` `get_x_service()` provider; orchestrates `domain` and `infra`
- **domain/** — plain dataclasses, enums, errors and pure rules; no torch /
  redis / qdrant / httpx / pydantic
- **infra/** — everything that touches models, stores, networks or files;
  shared clients are also provided by `@lru_cache` getters (for example
  RAG's `get_qdrant_service()`, `get_llm_client()`). Heavy libraries (torch,
  diffusers, qwen) import lazily, so every module loads without weights.

Tests build the app with `create_app(["<module>"])` and swap a service
through `app.dependency_overrides[get_x_service]`.

Errors keep FastAPI's `{"detail": ...}` body. RAG raises domain errors
(`InvalidRequestError`, `NotFoundError`, `ServiceUnavailableError`,
`UpstreamError`) and maps them to 400 / 404 / 503 / the upstream status in
`controller/errors.py`. The other modules raise `HTTPException` from their
controllers.

Known gaps: `rag/domain/chunker.py` still reads `config` for chunk sizes, and
recommendation's domain holds an abstract `VectorStore` plus a
`FeatureRegistry` rather than dataclasses only.

Routes follow Google AIP (resource paths, `:customMethod`, `page_size` /
`page_token`, standard status codes) directly in `controller/`; there is no
shared AIP helper package.

## Dependencies

One environment serves every module:

```bash
uv pip install -r requirements.txt --override overrides.txt
```

qwen-tts pins `transformers==4.57.3` and qwen-asr `4.57.6`; the override
settles on `4.57.6`. Image and video therefore use `transformers<4.58` and
`accelerate>=1.12`. The resolver keeps `diffusers` at 0.39 (0.40 needs a
newer `huggingface-hub`) and `redis` below 6.5 (the `celery[redis]` cap).
Dependabot ignores the versions that would break this set.

**Forbidden:** `routes/`, nested `src/` / `app/` inside a module, sub-folders
inside a layer (e.g. `domain/core/`), per-module `main.py`, ports or
`.env` files, dual `pyproject.toml` + `requirements.txt`.

## References

- [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [FastAPI dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [FastAPI lifespan events](https://fastapi.tiangolo.com/advanced/events/)
- [FastAPI handling errors](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- [Uvicorn](https://docs.uvicorn.org/)
- [uv pip overrides](https://docs.astral.sh/uv/concepts/resolution/#dependency-overrides)
- [Google AIP-121 Resource-oriented design](https://google.aip.dev/121)
- [Google AIP-136 Custom methods](https://google.aip.dev/136)
- [Google AIP-158 Pagination](https://google.aip.dev/158)

# Python ML helpers — identical minimal layout

Explore ML keeps six optional Python HTTP helpers under `python_ml/`.
Sibling product clients call their **API only**; that API calls these over
loopback.

Every helper uses the **same top-level directory** and the same basic DDD
layers: `controller` → `service` → `domain` ← `infra`. Each layer is one
folder of flat files (no sub-folders inside a layer).

## Forced layout

```
python_ml/<name>/
├── README.md
├── .env.example
├── requirements.txt      # serving dependencies
├── requirements-train.txt # training extras (all but video)
├── main.py               # FastAPI assemble + uvicorn
├── config.py             # os.getenv; RAG and recommendation also load .env
├── controller/           # FastAPI routers + inline Pydantic DTOs
├── service/              # XService classes, orchestration only
├── domain/               # dataclasses, enums, errors, pure rules
├── infra/                # model loading, clients, ETL, codecs
├── tests/                # pytest suite
├── training/             # fine-tuning / eval scripts (all but video)
└── (recommendation only) celery_app.py, tasks.py, run_*.py
```

Optional: `Dockerfile` (vision), runtime dirs (`output/`, `uploads/`,
`rag/data/qdrant` — never committed). Repo-level fixtures: `data/` (sibling of
`python_ml/`).

## Start

```bash
cd python_ml/<name>
uvicorn main:app --host 0.0.0.0 --port <port>
```

`python main.py` also works; it reads the port from the env vars below.

| Service          | Default port | Port env (first wins)               | UI proxy override    | Health check            |
| ---------------- | ------------ | ----------------------------------- | -------------------- | ----------------------- |
| recommendation   | 8000         | `PORT`, `RECOMMENDATION_PORT`       | `RECOMMENDATION_URL` | `GET /health`           |
| vision           | 8001         | `VISION_PORT` (ignores `PORT`)      | `VISION_URL`         | `GET /health`           |
| rag              | 8002         | `PORT`                              | `RAG_URL`            | `GET /health`, `/health/live`, `/health/ready` |
| image-playground | 8003         | `IMAGE_PLAYGROUND_PORT`, `PORT`     | `IMAGE_URL`          | none (`/openapi.json`)  |
| speech           | 8004         | `SPEECH_PORT`, `PORT`               | `SPEECH_URL`         | none (`/openapi.json`)  |
| video            | 8005         | `VIDEO_PORT`, `PORT`                | `VIDEO_URL`          | none (`/openapi.json`)  |

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
  RAG's `get_qdrant_service()`, `get_llm_client()`)

Tests swap a service through `app.dependency_overrides[get_x_service]`.
Helpers with a startup step (vision, video, recommendation, RAG) call it from
the FastAPI lifespan, e.g. `get_video_service().startup()`.

Errors keep FastAPI's `{"detail": ...}` body. RAG raises domain errors
(`InvalidRequestError`, `NotFoundError`, `ServiceUnavailableError`,
`UpstreamError`) and maps them to 400 / 404 / 503 / the upstream status in
`controller/errors.py`. The other helpers raise `HTTPException` from their
controllers.

Known gaps: `rag/domain/chunker.py` still reads `config` for chunk sizes, and
recommendation's domain holds an abstract `VectorStore` plus a
`FeatureRegistry` rather than dataclasses only.

Routes follow Google AIP (resource paths, `:customMethod`, `page_size` /
`page_token`, standard status codes) directly in `controller/`; there is no
shared AIP helper package.

**Forbidden:** `routes/`, nested `src/` / `app/` inside a helper, sub-folders
inside a layer (e.g. `domain/core/`), dual `pyproject.toml` +
`requirements.txt`.

## References

- [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [FastAPI dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [FastAPI lifespan events](https://fastapi.tiangolo.com/advanced/events/)
- [FastAPI handling errors](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- [Uvicorn](https://docs.uvicorn.org/)
- [Google AIP-121 Resource-oriented design](https://google.aip.dev/121)
- [Google AIP-136 Custom methods](https://google.aip.dev/136)
- [Google AIP-158 Pagination](https://google.aip.dev/158)

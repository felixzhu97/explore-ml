# Python ML helpers — identical minimal layout

Explore ML keeps four optional Python HTTP helpers under `python_ml/`.
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
├── requirements.txt      # sole dependency list
├── main.py               # FastAPI assemble + uvicorn
├── config.py             # dotenv + os.getenv (ports)
├── controller/           # FastAPI routers + request/response DTOs
├── service/              # orchestration only
├── domain/               # models, value objects, pure rules
├── infra/                # model loading, clients, ETL, codecs
├── tests/                # at least test_health.py or existing suite
├── training/             # optional fine-tuning / eval scripts
└── (recommendation only) celery_app.py, tasks.py, run_*.py
```

Optional: `Dockerfile`, runtime dirs (`output/`, `uploads/` — gitignored).
Repo-level fixtures: `data/` (sibling of `python_ml/`).

## Start

```bash
cd python_ml/<name>
uvicorn main:app --host 0.0.0.0 --port $PORT
```

| Service        | Default port | Typical consumer env       |
| -------------- | ------------ | -------------------------- |
| recommendation | 8000         | `RECOMMENDATION_API_URL`   |
| vision         | 8001         | `VISION_SERVICE_URL`       |
| rag            | 8002         | `RAG_SERVICE_URL`          |
| image-playground | 8003      | `IMAGE_PLAYGROUND_API_URL` |
| speech         | 8004         | `SPEECH_API_URL` |
| video          | 8005         | `VIDEO_API_URL` |

## Layering

- **controller/** — request/response only; call `service`
- **service/** — orchestration; call `domain` and `infra`
- **domain/** — models and business rules; no torch / redis / qdrant / httpx
- **infra/** — everything that touches models, stores, networks or files

Routes follow Google AIP (resource paths, `:customMethod`, `page_size` /
`page_token`, standard status codes) directly in `controller/`; there is no
shared AIP helper package. Errors use FastAPI's default `{"detail": ...}`.

**Forbidden:** `routes/`, nested `src/` / `app/` inside a helper, sub-folders
inside a layer (e.g. `domain/core/`), dual `pyproject.toml` +
`requirements.txt`.

## References

- [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [Uvicorn](https://docs.uvicorn.org/)
- [Google AIP-121 Resource-oriented design](https://google.aip.dev/121)
- [Google AIP-136 Custom methods](https://google.aip.dev/136)
- [Google AIP-158 Pagination](https://google.aip.dev/158)

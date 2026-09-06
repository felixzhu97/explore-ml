# Python ML helpers — identical minimal layout

Explore ML keeps four optional Python HTTP helpers under `python_ml/`.
Sibling product clients call their **API only**; that API calls these over
loopback.

Every helper uses the **same top-level directory** and the same layers:
`api` → `service` → `domain`.

## Forced layout

```
python_ml/<name>/
├── README.md
├── .env.example
├── requirements.txt      # sole dependency list
├── main.py               # FastAPI assemble + uvicorn
├── config.py             # dotenv + os.getenv (ports)
├── api.py                # all HTTP (flat api_*.py allowed; no routes/ dir)
├── service.py            # orchestration only
├── domain/               # ML / ETL / schemas / utils
│   └── __init__.py
├── tests/                # at least test_health.py or existing suite
└── (recommendation only) celery_app.py, tasks.py, run_*.py
```

Optional: shared HTTP helpers under `aip/` when a service already has them,
`Dockerfile`, runtime dirs (`output/`, `uploads/` — gitignored).
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
| media-gen      | 8003         | `MEDIA_GENERATION_API_URL` |

## Layering

- **api.py** — request/response only; call `service`
- **service.py** — orchestration; call `domain` / external I/O
- **domain/** — models, ETL, embeddings, parsers (never HTTP routers)

**Forbidden:** `routes/`, nested `src/` / `app/` inside a helper, root-level
`etl/` / `core/` / `schemas/` (those live under `domain/`), dual
`pyproject.toml` + `requirements.txt`.

## References

- [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [Uvicorn](https://docs.uvicorn.org/)

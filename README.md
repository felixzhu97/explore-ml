# Explore ML

`explore-ml` hosts optional Python FastAPI helpers used by sibling Explore
products (especially [explore-chat](https://github.com/felixzhu97/explore-chat)).
You can run recommendation, vision, RAG, and media generation on loopback.
Clients never call these services directly; Spring (or another API) proxies.

Four services live under `python_ml/` today (separate ports). A future cut
may fold them behind one port without moving the folder boundary. `ui/` is
reserved for a model-test front end; `data/` holds test fixtures.

## Get started

### Requirements

- Python 3.11+
- Git
- Optional: Redis (recommendation Celery), Ollama / GPU stack per service README

### Initial setup

```bash
git clone https://github.com/felixzhu97/explore-ml.git
cd explore-ml
```

### Run a service

```bash
cd python_ml/recommendation   # or vision / rag / media-gen
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

| Service        | Default port | Health (typical) |
| -------------- | ------------ | ---------------- |
| recommendation | 8000         | `GET /health`    |
| vision         | 8001         | `GET /health`    |
| rag            | 8002         | `GET /health`    |
| media-gen      | 3456         | `GET /health`    |

Point explore-chat `chat.upstreams.*` (or env overrides) at these URLs.
Ports stay the same after the extract so existing local configs keep working.

### Checks

```bash
cd python_ml/<name> && pytest
```

## Configuration

Each service ships `.env.example`. Do not commit real secrets. Large model
weights and generated media stay out of git; put small fixtures under `data/`.

## Next steps

- [Python services layout](docs/developer/python-services.md)
- [Glossary](docs/Glossary.md)
- [C4 model](docs/developer/c4-model/)
- [User Story Map](docs/product-owner/User-Story-Map.md)

## Repository layout

```text
python_ml/     FastAPI helpers (recommendation / vision / rag / media-gen)
ui/            Model-test UI (placeholder)
data/          Test / fixture data
docs/          Glossary, C4, product-owner, developer guides
```

## Contributing

Prefer a single English kebab-case branch slug, small PRs with a clear why
and References, and keep Glossary plus C4 in sync when service boundaries
change.

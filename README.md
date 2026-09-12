# Explore ML

`explore-ml` is a set of optional Python FastAPI helpers you can run beside
sibling Explore products. You can use it to serve recommendation, vision, RAG,
and media generation — including speech transcription — on loopback.

Product clients never call these helpers directly. A Spring (or other) API
proxies over localhost. Four services live under `python_ml/` today on
contiguous ports `8000`–`8005`. A future cut may fold them behind one port
without moving the folder boundary. `ui/` is reserved for a model-test front
end; `data/` holds small fixtures.

## Get started

### Requirements

You need Python 3.11+ and Git. Redis is optional for recommendation Celery
workers. Some helpers also expect Ollama, a GPU stack, or local model weights —
see each service README and the
[Model download](docs/user-guide/model-download.md) guide.

### Initial setup

```bash
git clone https://github.com/felixzhu97/explore-ml.git
cd explore-ml
```

### Run your first service

```bash
cd python_ml/recommendation   # or vision / rag / image-playground / speech / video
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

This creates a virtualenv, installs dependencies, copies the example env file,
and starts the recommendation API on port `8000`. Swap the directory and port
for the other helpers:

| Service        | Default port | Health (typical) |
| -------------- | ------------ | ---------------- |
| recommendation | 8000         | `GET /health`    |
| vision         | 8001         | `GET /health`    |
| rag            | 8002         | `GET /health`    |
| image-playground | 8003       | `GET /health`    |
| speech         | 8004         | `GET /health`    |
| video          | 8005         | `GET /health`    |

Wire your product’s upstream or env config to these loopback URLs. For a fuller
walkthrough, see the [User Guide](docs/user-guide/README.md).

### Configuration

Each service ships `.env.example`. Do not commit real secrets. Large model
weights stay out of git under `LOCAL_MODELS_ROOT`; download them with the
[Model download](docs/user-guide/model-download.md) guide. Image Playground / Speech / Video and RAG
rerank prefer those local Qwen paths and can be overridden via env. Put small
fixtures under `data/`.

### Checks

```bash
cd python_ml/<name> && pytest
```

## Next steps

- Follow the [User Guide](docs/user-guide/README.md) for local setup and
  loopback integration.
- Download checkpoints with the
  [Model download](docs/user-guide/model-download.md) guide.
- Read the [Guideline](docs/Guideline.md) for ML practice boundaries.
- Learn the shared
  [Python services layout](docs/developer/python-services.md).
- Browse the [Glossary](docs/Glossary.md) and
  [C4 model](docs/developer/c4-model/).
- Review the [User Story Map](docs/product-owner/User-Story-Map.md).

## Repository layout

```text
python_ml/     FastAPI helpers (recommendation / vision / rag / image-playground / speech / video)
ui/            Model-test UI (placeholder)
data/          Test / fixture data
docs/          Glossary, Guideline, user-guide, C4, product-owner
```

## Contributing

Contributions are welcome. Prefer a single English kebab-case branch slug,
small PRs with a clear why and References, and keep Glossary plus C4 in sync
when service boundaries change.

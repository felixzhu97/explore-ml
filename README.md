# Explore ML

`explore-ml` is a set of optional Python FastAPI helpers you can run beside
sibling Explore products. You can use it to serve recommendation, vision, RAG,
and media generation — including speech transcription — on loopback.

Product clients never call these helpers directly. A Spring (or other) API
proxies over localhost. Six services live under `python_ml/` today on
contiguous ports `8000`–`8005`. A future cut may fold them behind one port
without moving the folder boundary. `ui/` is an Angular model-test front end
for those helpers; `data/` holds small fixtures.

## Get started

### Requirements

You need Python 3.11+ and Git. The optional model-test UI needs Node.js
22.22+ or 24.15+. Redis is optional for recommendation Celery workers. Some
helpers also expect Ollama, a GPU stack, or local model weights — see each
service README and the [Model download](docs/user-guide/model-download.md)
guide.

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
and starts the recommendation API on port `8000`. Only RAG and recommendation
load `.env` automatically; for the other helpers, export the variables in your
shell instead. Swap the directory and port for the other helpers:

| Service          | Default port | Health check                       |
| ---------------- | ------------ | ---------------------------------- |
| recommendation   | 8000         | `GET /health`                      |
| vision           | 8001         | `GET /health`                      |
| rag              | 8002         | `GET /health`, `GET /health/ready` |
| image-playground | 8003         | none; `GET /openapi.json`          |
| speech           | 8004         | none; `GET /openapi.json`          |
| video            | 8005         | none; `GET /openapi.json`          |

Wire your product’s upstream or env config to these loopback URLs. For a fuller
walkthrough, see the [User Guide](docs/user-guide/README.md).

### Start the model test UI (optional)

```bash
cd ui
npm ci
npm start
```

This serves the UI at <http://localhost:4200>. It proxies `/svc/<id>` to the
helpers above without CORS setup (`image` is Image Playground). Each helper module has one page where you
can call all of its endpoints. See
[ui/README.md](ui/README.md).

### Configuration

Each service ships `.env.example`. Do not commit real secrets. Large model
weights stay out of git under `LOCAL_MODELS_ROOT`; download them with the
[Model download](docs/user-guide/model-download.md) guide. Image Playground,
Speech, RAG rerank and the recommendation feed ranker read those paths; Video
loads a Hugging Face id (`COGVIDEOX_MODEL`). Every path can be overridden via
env. Put small fixtures under `data/`.

### Checks

```bash
cd python_ml/<name> && pytest
```

For the UI, run `npm test` and `npm run build` in `ui/`.

GitHub Actions runs on every pull request and every push to `main`: `pytest`
for the RAG helper (Python 3.12) and the UI tests and build (Node 22). Run the
other helpers' suites locally.

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
ui/            Model-test UI (Angular, NG-ZORRO, Tailwind, d3)
data/          Test / fixture data
docs/          Glossary, Guideline, user-guide, C4, product-owner
```

## Contributing

Contributions are welcome. Prefer a single English kebab-case branch slug,
small PRs with a clear why and References, and keep Glossary plus C4 in sync
when service boundaries change.

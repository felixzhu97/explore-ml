# Explore ML

`explore-ml` is an optional Python FastAPI app you can run beside sibling
Explore products. It serves recommendation, vision, RAG, and media
generation — including speech transcription — on loopback.

Product clients never call it directly. A Spring (or other) API proxies over
localhost. Six modules live under `python_ml/` as packages of one process on
port `8000`. `ui/` is an Angular model-test front end with D3 charts for
every module; `data/` holds small fixtures.

## Get started

### Requirements

You need Python 3.11+ and Git. The optional model-test UI needs Node.js
22.22+ or 24.15+. Redis is optional for recommendation Celery workers. Some
modules also expect Ollama, a GPU stack, or local model weights — see each
module README and the [Model download](docs/user-guide/model-download.md)
guide.

### Initial setup

```bash
git clone https://github.com/felixzhu97/explore-ml.git
cd explore-ml
```

### Run the app

```bash
cd python_ml
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt --override overrides.txt
cp .env.example .env
uvicorn main:app --port 8000
```

This creates a virtualenv, installs every module's dependencies, copies the
secrets file (loaded automatically) and starts all six modules on port
`8000`. `GET /health` reports each module's status. Details:
[`python_ml/README.md`](python_ml/README.md).

| Module           | Package            | Operations under `/api/v1`                      |
| ---------------- | ------------------ | ----------------------------------------------- |
| Recommendation   | `recommendation`   | `{feeds,explores,reels}:rank`, `feeds:recall`   |
| Vision           | `vision`           | `images:predict`, `{images,videos}:moderate`    |
| RAG              | `rag`              | `documents:query`, `documents:streamQuery`, …   |
| Image Playground | `image_playground` | `images:generate`, `imageJobs/{id}`             |
| Speech           | `speech`           | `voices:synthesize`, `audios:transcribe`, WS    |
| Video            | `video`            | `videos:generate`, `videoJobs/{id}`             |

Wire your product’s upstream to `http://127.0.0.1:8000`. For a fuller
walkthrough, see the [User Guide](docs/user-guide/README.md).

### Start the model test UI (optional)

```bash
cd ui
npm ci
npm start
```

This serves the UI at <http://localhost:4200>. It proxies `/ml/*` to the app
on port `8000` without CORS setup. Each module has one page where you can call
all of its endpoints and see the results charted with D3. See
[ui/README.md](ui/README.md).

### Configuration

Settings are constants in `python_ml/config.py` and each
`<module>/config.py`; edit them in place. `python_ml/.env` holds only
secrets (`DATABASE_URL`, `REDIS_PASSWORD`, `OPENAI_API_KEY`); never commit
it. Large model weights stay out of git under `~/Codes/models`
(`LOCAL_MODELS_ROOT`); download them with the
[Model download](docs/user-guide/model-download.md) guide. Image
Playground, Speech, RAG rerank and the recommendation feed ranker read
those paths; Video loads a Hugging Face id (`COGVIDEOX_MODEL`). Put small
fixtures under `data/`.

### Checks

```bash
cd python_ml && pytest -q tests <module>/tests
```

For the UI, run `npm test` and `npm run build` in `ui/`.

GitHub Actions runs on every pull request and every push to `main`: `pytest`
for the app and RAG (Python 3.12) and the UI tests and build (Node 22). Run
the other modules' suites locally.

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
python_ml/     One FastAPI app (recommendation / vision / rag / image_playground / speech / video)
ui/            Model-test UI (Angular, NG-ZORRO, Tailwind, D3)
data/          Test / fixture data
docs/          Glossary, Guideline, user-guide, C4, product-owner
```

## Contributing

Contributions are welcome. Prefer a single English kebab-case branch slug,
small PRs with a clear why and References, and keep Glossary plus C4 in sync
when module boundaries change.

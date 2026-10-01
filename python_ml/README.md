# Machine learning helpers

One FastAPI app on port **8000** serves six modules. Sibling Explore APIs
and the UI call it over loopback.

| Module | Package | Role | Operations |
| --- | --- | --- | --- |
| Recommendation | `recommendation` | Feed / Explore / Reels rank and recall | `feeds:rank`, `explores:rank`, `reels:rank`, `feeds:recall` |
| Vision | `vision` | Image labels and image / video moderation | `images:predict`, `images:moderate`, `videos:moderate` |
| RAG | `rag` | Document, webpage and post Q&A | `documents:query`, `documents:streamQuery`, `documents`, `collections`, … |
| Image Playground | `image_playground` | Text-to-image jobs | `images:generate`, `imageJobs/{id}` |
| Speech | `speech` | TTS and ASR (file and WebSocket) | `voices:synthesize`, `audios:transcribe`, `ws/v1/audios:transcribe` |
| Video | `video` | Text-to-video jobs | `videos:generate`, `videoJobs/{id}` |

Every operation lives under `/api/v1/<collection>:<method>` with no module
prefix ([AIP-136](https://google.aip.dev/136) custom methods). Layout and
module contract: [`docs/developer/python-services.md`](../docs/developer/python-services.md).

## Run

```bash
cd python_ml
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt --override overrides.txt
cp .env.example .env          # secrets only; loaded at startup
uvicorn main:app --port 8000  # or: python main.py
```

`overrides.txt` pins `transformers==4.57.6`. qwen-tts pins `4.57.3` and
qwen-asr pins `4.57.6`; both work with `4.57.6`, so the override lets uv
resolve one environment. LightFM does not build on Python 3.12, so it
lives in `recommendation/requirements-optional.txt`.

Heavy model libraries load lazily, so the app starts without weights.
RAG reports `degraded` in `/health` until its embedding model in Ollama
is reachable.

## Shared endpoints

| Path | Purpose |
| --- | --- |
| `GET /health` | `{status: ok \| degraded, modules: {name: {status, latency_ms, …}}}` |
| `GET /docs` | OpenAPI UI for all modules |

## Settings

Settings are constants in code; edit the file to change one.

| File | Holds |
| --- | --- |
| [`config.py`](config.py) | `HOST`, `PORT`, `BASE_URL` (media URLs), `LOCAL_MODELS_ROOT` (`~/Codes/models`) |
| `<module>/config.py` | Models, backends, thresholds and service URLs for that module |

Only secrets come from `python_ml/.env` ([`.env.example`](.env.example)):
`DATABASE_URL` and `REDIS_PASSWORD` (recommendation) and
`OPENAI_API_KEY` (RAG with the OpenAI provider).

## Batch jobs and training

Run from `python_ml/` so package imports resolve:

```bash
python -m recommendation.run_jobs --job suggestions
celery -A recommendation.celery_app worker -l info -B
python -m vision.training.train_head --data <dir> --output <dir>
python -m rag.training.eval_retrieval --url http://localhost:8000
python -m image_playground.training.compare_prompts --lora <dir> --prompts prompts.txt
python -m speech.training.eval_wer --help
```

## Tests

```bash
cd python_ml
pytest -q                     # app tests (tests/)
pytest -q tests rag/tests     # what CI runs
```

## Container

```bash
docker build -t explore-ml python_ml
docker run -p 8000:8000 --env-file python_ml/.env explore-ml
```

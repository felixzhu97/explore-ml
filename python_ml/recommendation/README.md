# Recommendation Service (Python)

Layout (same as other Python helpers): `main.py` / `config.py` / `controller/` /
`service/` / `domain/` / `infra/` / `tests/` / `training/`, plus
`celery_app.py`, `tasks.py` and the `run_*.py` batch entry points.
Start: `uvicorn main:app --host 0.0.0.0 --port 8000`.

Offline and online recommendation stack for Explore products:

- Batch jobs for follow suggestions, the explore hot list and recall vectors
- One PyTorch feed ranker that scores Feed, Explore and Reels candidates
- A FastAPI service for rank and recall, called by a sibling API or the
  Model Test UI over loopback

## Setup

```bash
cd python_ml/recommendation
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env       # loaded automatically
```

Point `.env` at the same Postgres (`DATABASE_URL`), Redis (`REDIS_URL`,
`REDIS_PASSWORD`) and Cassandra (`CASSANDRA_CONTACT_POINTS`,
`CASSANDRA_KEYSPACE`, `CASSANDRA_LOCAL_DC`) as the product backend.

## Batch jobs (CLI)

User suggestions merge three sources in order (LightFM with user features,
implicit ALS with an Annoy index, then friend-of-friend) and write to Redis
`recommendation:user:{userId}`. Friend-of-friend reads at most
`FRIEND_OF_FRIEND_FOLLOWING_LIMIT` (500) followees per user.

```bash
python run_user_suggestions.py
# or
python run_jobs.py --job suggestions
```

Explore hot list (Cassandra engagement + hot score → Redis `explore:hot`,
TTL `EXPLORE_TTL_SECONDS` = 300):

```bash
python run_explore.py
# or
python run_jobs.py --job explore
```

Feed ranking model (PyTorch, trained from Cassandra `post_likes` and
`post_engagement_counts`). It writes to `FEED_RANKER_MODEL`, which defaults to
`$RECOMMENDATION_MODEL_DIR/feed_ranker.pt`
(`$LOCAL_MODELS_ROOT/recommendation/models`). Serving reads the same path.
Per-variant files such as `feed_ranker_<experiment>_<variant>.pt` load from the
same directory:

```bash
python run_jobs.py --job feed_rank
python run_jobs.py --job feed_rank --init-from "$RECOMMENDATION_MODEL_DIR/feed_ranker.pt" \
  --output "$RECOMMENDATION_MODEL_DIR/feed_ranker-ft-$(date +%Y%m%d).pt"
python -m training.eval_feed_ranker --model <model.pt> --holdout <holdout.jsonl> \
  [--baseline <base.pt>] [--k 10]
```

See the [fine-tuning guide](../../docs/user-guide/fine-tuning.md) for warm-start
and evaluation.

Vector towers for recall (user/post embeddings → `RedisVectorStore`
`rec:user:vec:{id}`, `rec:post:vec:{id}`):

```bash
python -m training.pytorch_towers
```

`training/pytorch_reels_multimodal.py` is an experiment; serving does not load
it.

## Online service (FastAPI)

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
# or: python main.py / python run_service.py
```

The port comes from `PORT`, then `RECOMMENDATION_PORT` (default `8000`); the
host from `HOST`. Endpoints:

- `GET /health` → `{status: "ok", service: "recommendation"}`
- `POST /api/v1/feeds:rank` – rank feed candidates for a user
- `POST /api/v1/explores:rank` – rank explore candidates
- `POST /api/v1/reels:rank` – rank Reels candidates
- `POST /api/v1/feeds:recall` – nearest posts for a user from the vector store

Rank request: `{user_id, candidate_ids, limit (50), region?, language?,
experiment_id?, variant_id?}`. Recall request: `{user_id, limit (100)}`. Both
return `{items: [{id, score}]}`.

All three rank routes use the same feed ranker; `explores:rank` does not read
`explore:hot`, so pass the hot list as `candidate_ids`. When no model file is
found, candidates come back in their original order with score `1.0`. Recall
only works with the Redis store; with `VECTOR_BACKEND=faiss` it returns an
empty list.

Environment variables:

- `VECTOR_BACKEND` – `redis` (default) or `faiss`
- `FAISS_DIM` (default `64`), `FAISS_INDEX_PATH`, `FAISS_IDS_PATH` – Faiss
  index configuration
- `FEED_RANKER_MODEL`, `RECOMMENDATION_MODEL_DIR`, `LOCAL_MODELS_ROOT` –
  model paths

## Celery (optional)

Run the batch jobs on a schedule with Redis as broker.

```bash
celery -A celery_app worker -l info        # run tasks
celery -A celery_app beat -l info          # suggestions every 6h, explore every 5min
celery -A celery_app worker -l info -B     # both in one process (dev only)
```

Trigger tasks manually:

```python
from tasks import run_suggestions, run_explore

run_suggestions.delay()
run_explore.delay()
```

`CELERY_BROKER_URL` falls back to the `REDIS_URL` env var, then to
`redis://localhost:6379/0`.

## Tests

```bash
pytest -q   # tests/test_health.py, tests/test_fine_tuning.py
```

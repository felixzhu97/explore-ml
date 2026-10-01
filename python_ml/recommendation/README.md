# Recommendation Service (Python)

Package `recommendation` in the single Explore ML app (port 8000):
`module.py` / `config.py` / `controller/` / `service/` / `domain/` / `infra/` /
`tests/` / `training/`, plus `celery_app.py`, `tasks.py` and the `run_*.py`
batch entry points. Setup and run commands:
[`python_ml/README.md`](../README.md).

Offline and online recommendation stack for Explore products:

- Batch jobs for follow suggestions, the explore hot list and recall vectors
- One PyTorch feed ranker that scores Feed, Explore and Reels candidates
- A FastAPI service for rank and recall, called by a sibling API or the
  Model Test UI over loopback

## Setup

Install from `python_ml/` as described there. LightFM is optional
(`requirements-optional.txt`) because it does not build on Python 3.12;
without it the suggestions job skips that source.

Use the same Postgres, Redis and Cassandra as the product backend. The
secrets `DATABASE_URL` and `REDIS_PASSWORD` come from `python_ml/.env`;
`REDIS_URL`, `CASSANDRA_CONTACT_POINTS`, `CASSANDRA_KEYSPACE` and
`CASSANDRA_LOCAL_DC` are constants in [`config.py`](config.py).

## Batch jobs (CLI)

User suggestions merge three sources in order (LightFM with user features,
implicit ALS with an Annoy index, then friend-of-friend) and write to Redis
`recommendation:user:{userId}`. Friend-of-friend reads at most
`FRIEND_OF_FRIEND_FOLLOWING_LIMIT` (500) followees per user.

Run every command below from `python_ml/`:

```bash
python -m recommendation.run_user_suggestions
# or
python -m recommendation.run_jobs --job suggestions
```

Explore hot list (Cassandra engagement + hot score → Redis `explore:hot`,
TTL `EXPLORE_TTL_SECONDS` = 300):

```bash
python -m recommendation.run_explore
# or
python -m recommendation.run_jobs --job explore
```

Feed ranking model (PyTorch, trained from Cassandra `post_likes` and
`post_engagement_counts`). It writes to `FEED_RANKER_MODEL`, which defaults to
`$RECOMMENDATION_MODEL_DIR/feed_ranker.pt`
(`$LOCAL_MODELS_ROOT/recommendation/models`). Serving reads the same path.
Per-variant files such as `feed_ranker_<experiment>_<variant>.pt` load from the
same directory:

```bash
python -m recommendation.run_jobs --job feed_rank
python -m recommendation.run_jobs --job feed_rank --init-from "$RECOMMENDATION_MODEL_DIR/feed_ranker.pt" \
  --output "$RECOMMENDATION_MODEL_DIR/feed_ranker-ft-$(date +%Y%m%d).pt"
python -m recommendation.training.eval_feed_ranker --model <model.pt> --holdout <holdout.jsonl> \
  [--baseline <base.pt>] [--k 10]
```

See the [fine-tuning guide](../../docs/user-guide/fine-tuning.md) for warm-start
and evaluation.

Vector towers for recall (user/post embeddings → `RedisVectorStore`
`rec:user:vec:{id}`, `rec:post:vec:{id}`):

```bash
python -m recommendation.training.pytorch_towers
```

`training/pytorch_reels_multimodal.py` is an experiment; serving does not load
it.

## Online service (FastAPI)

The routes are served by the shared app on port 8000. In `GET /health` the
module reports `{status: "ok", ranker: true | false}`; `ranker` is false
when no model file was found. Endpoints:

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
only works with the Redis store; with `VECTOR_BACKEND = "faiss"` it returns
an empty list.

Constants in `config.py`:

- `VECTOR_BACKEND` – `"redis"` or `"faiss"`
- `FAISS_DIM` (`64`), `FAISS_INDEX_PATH`, `FAISS_IDS_PATH` – Faiss index
- `FEED_RANKER_MODEL`, `RECOMMENDATION_MODEL_DIR` – model paths under the
  shared `LOCAL_MODELS_ROOT`

## Celery (optional)

Run the batch jobs on a schedule with Redis as broker.

```bash
celery -A recommendation.celery_app worker -l info     # run tasks
celery -A recommendation.celery_app beat -l info       # suggestions every 6h, explore every 5min
celery -A recommendation.celery_app worker -l info -B  # both in one process (dev only)
```

Trigger tasks manually:

```python
from recommendation.tasks import run_suggestions, run_explore

run_suggestions.delay()
run_explore.delay()
```

The broker is `CELERY_BROKER_URL` (`redis://localhost:6379/0`) in
`config.py`.

## Tests

```bash
cd python_ml
pytest -q recommendation/tests
```

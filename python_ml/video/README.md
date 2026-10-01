# Video

Local loopback video generation (CogVideoX). Plain **Video** name — Apple has no
Image Playground–style generative video API. Port: **8005** (`VIDEO_PORT`,
then `PORT`).

Layout (same as other Python helpers): `main.py` / `config.py` / `controller/` /
`service/` / `domain/` / `infra/` / `tests/`. Video has no `training/`.

## Setup

```bash
cd python_ml/video
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8005
```

This helper does not load `.env`; export the variables from `.env.example` in
your shell. The pipeline warms up at startup.

On macOS without CUDA, local generation is skipped: jobs fail with "Local
video generation not supported on this platform". Set `VIDEO_FORCE_LOCAL=1`
(or the legacy `VIDEO_GEN_FORCE_LOCAL=1`) to try anyway.

## API

There is no `/health` route; use `GET /openapi.json` as a liveness check.

- `POST /api/v1/videos:generate` with `{prompt, image_url?}` → `{job_id}`.
  `image_url` is accepted but not used yet.
- `GET /api/v1/videoJobs/{video_job}` → `{name: "videoJobs/{id}", status,
  video_url?, error?}`; `status` is `pending`, `succeeded` or `failed`. Unknown
  jobs return 404.
- `GET /output/video/{job_id}.mp4`

Poll the job until `status` is `succeeded`, then fetch `video_url`.

## Configuration

| Variable | Default |
| -------- | ------- |
| `VIDEO_HOST` / `VIDEO_PORT` / `VIDEO_BASE_URL` | `0.0.0.0` / `8005` / `http://localhost:<port>` |
| `VIDEO_OUTPUT_DIR` | `output` |
| `COGVIDEOX_MODEL` | `THUDM/CogVideoX-2b` (Hugging Face id; `LOCAL_MODELS_ROOT` is not used) |
| `VIDEO_DEVICE=cpu` | force CPU (otherwise CUDA, then MPS) |
| `VIDEO_FORCE_LOCAL=1` | run locally on macOS without CUDA |
| `HF_ENDPOINT` | `https://hf-mirror.com` when unset |

## Tests

```bash
pytest -q   # test_config.py, test_health.py
```

# Video

Local loopback video generation (CogVideoX). Plain **Video** name — Apple has no
Image Playground–style generative video API.

Package `video` in the single Explore ML app (port 8000): `module.py` /
`config.py` / `controller/` / `service/` / `domain/` / `infra/` / `tests/`.
Video has no `training/`.

## Setup

Setup, `.env` and run commands: [`python_ml/README.md`](../README.md). The pipeline warms up at startup.

On macOS without CUDA, local generation is skipped: jobs fail with "Local
video generation not supported on this platform". Set `VIDEO_FORCE_LOCAL=1`
(or the legacy `VIDEO_GEN_FORCE_LOCAL=1`) to try anyway.

## API

In the app's `GET /health` the module reports
`{status: "ok", model, local}`; `local` is false when local generation is
skipped on this platform.

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
| `BASE_URL` (shared) | `http://localhost:$PORT` |
| `VIDEO_OUTPUT_DIR` | `video/output` |
| `COGVIDEOX_MODEL` | `THUDM/CogVideoX-2b` (Hugging Face id; `LOCAL_MODELS_ROOT` is not used) |
| `VIDEO_DEVICE=cpu` | force CPU (otherwise CUDA, then MPS) |
| `VIDEO_FORCE_LOCAL=1` | run locally on macOS without CUDA |
| `HF_ENDPOINT` | `https://hf-mirror.com` when unset |

## Tests

```bash
cd python_ml
pytest -q video/tests
```

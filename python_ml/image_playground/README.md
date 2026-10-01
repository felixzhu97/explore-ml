# Image Playground

Local loopback image generation (Apple [Image Playground](https://developer.apple.com/documentation/imageplayground)–aligned name).
Port: **8003** (`IMAGE_PLAYGROUND_PORT`, then `PORT`).

Layout: `main.py` / `config.py` / `controller/` / `service/` / `domain/` /
`infra/` / `tests/` / `training/`.

| Capability | Default backend | Local path (under `LOCAL_MODELS_ROOT`) | Other |
| ---------- | --------------- | -------------------------------------- | ----- |
| Image      | `qwen`          | `image/models/Qwen-Image`              | `IMAGE_BACKEND=sd` (default `runwayml/stable-diffusion-v1-5`) |

`IMAGE_MODEL` overrides the model for either backend; `SD_MODEL` is read when
`IMAGE_MODEL` is unset.

## Setup

```bash
cd python_ml/image-playground
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8003
```

This helper does not load `.env`; export the variables from `.env.example` in
your shell. The pipeline loads on the first generate request, not at startup.

## API

There is no `/health` route; use `GET /openapi.json` as a liveness check.

- `POST /api/v1/images:generate` with `{prompt, negative_prompt?}` →
  `{job_id}`
- `GET /api/v1/imageJobs/{image_job}` → `{name: "imageJobs/{id}", status,
  image_url?, error?}`; `status` is `pending`, `succeeded` or `failed`.
  Unknown jobs return 404.
- `GET /output/image/{job_id}.png`

Poll the job until `status` is `succeeded`, then fetch `image_url`.

## Configuration

| Variable | Default |
| -------- | ------- |
| `IMAGE_PLAYGROUND_HOST` / `IMAGE_PLAYGROUND_PORT` / `IMAGE_PLAYGROUND_BASE_URL` | `0.0.0.0` / `8003` / `http://localhost:<port>` |
| `IMAGE_PLAYGROUND_OUTPUT_DIR` | `output` |
| `IMAGE_PLAYGROUND_DEVICE=cpu` | force CPU |
| `IMAGE_BACKEND` / `IMAGE_MODEL` / `SD_MODEL` | `qwen` / per backend / — |
| `IMAGE_LORA_PATH` / `IMAGE_LORA_SCALE` | — / `1.0` |
| `LOCAL_MODELS_ROOT` | `~/Codes/models` |
| `HF_ENDPOINT` | `https://hf-mirror.com` when unset |

## LoRA

Set `IMAGE_LORA_PATH` to a LoRA directory and optionally `IMAGE_LORA_SCALE`.
The adapter loads as `fine_tuned` together with the pipeline. Train one with
`training/train_lora.py` on Hugging Face Jobs, then compare it with the base
model on fixed prompts and seeds:

```bash
python -m training.compare_prompts --lora <dir> --prompts prompts.txt \
  [--out compare] [--seed 0] [--steps 20]
```

See the [fine-tuning guide](../../docs/user-guide/fine-tuning.md).

## Tests

```bash
pytest -q   # test_health.py, test_jobs_api.py, test_local_models_config.py, test_lora.py
```

# Image Playground

Local loopback image generation (Apple [Image Playground](https://developer.apple.com/documentation/imageplayground)–aligned name).
Package `image_playground` in the single Explore ML app (port 8000):
`module.py` / `config.py` / `controller/` / `service/` / `domain/` / `infra/` /
`tests/` / `training/`.

| Capability | Default backend | Local path (under `LOCAL_MODELS_ROOT`) | Other |
| ---------- | --------------- | -------------------------------------- | ----- |
| Image      | `qwen`          | `image/models/Qwen-Image`              | `IMAGE_BACKEND = "sd"` (`runwayml/stable-diffusion-v1-5`) |

`IMAGE_MODEL` follows the backend; edit it in `config.py` to load another
model.

## Setup

Setup and run commands: [`python_ml/README.md`](../README.md). The pipeline
loads on the first generate request, not at startup.

## API

In the app's `GET /health` the module reports
`{status: "ok", backend, lora}`.

- `POST /api/v1/images:generate` with `{prompt, negative_prompt?}` →
  `{job_id}`
- `GET /api/v1/imageJobs/{image_job}` → `{name: "imageJobs/{id}", status,
  image_url?, error?}`; `status` is `pending`, `succeeded` or `failed`.
  Unknown jobs return 404.
- `GET /output/image/{job_id}.png`

Poll the job until `status` is `succeeded`, then fetch `image_url`.

## Configuration

Constants in [`config.py`](config.py); the device is CUDA, then MPS, then
CPU.

| Constant | Value |
| -------- | ----- |
| `BASE_URL` (shared, `python_ml/config.py`) | `http://localhost:8000` |
| `IMAGE_OUTPUT` | `image_playground/output/image` |
| `IMAGE_BACKEND` / `IMAGE_MODEL` | `"qwen"` / per backend |
| `IMAGE_LORA_PATH` / `IMAGE_LORA_SCALE` | `None` / `1.0` |
| `LOCAL_MODELS_ROOT` (shared) | `~/Codes/models` |

The app sets `HF_ENDPOINT=https://hf-mirror.com` when it is unset.

## LoRA

Set `IMAGE_LORA_PATH` to a LoRA directory and optionally `IMAGE_LORA_SCALE`.
The adapter loads as `fine_tuned` together with the pipeline. Train one with
`training/train_lora.py` on Hugging Face Jobs, then compare it with the base
model on fixed prompts and seeds:

```bash
python -m image_playground.training.compare_prompts --lora <dir> --prompts prompts.txt \
  [--out compare] [--seed 0] [--steps 20]
```

See the [fine-tuning guide](../../docs/user-guide/fine-tuning.md).

## Tests

```bash
cd python_ml
pytest -q image_playground/tests
```

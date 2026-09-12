# Image Playground

Local loopback image generation (Apple [Image Playground](https://developer.apple.com/documentation/imageplayground)–aligned name).
Port: **8003**.

Layout: `main.py` / `config.py` / `api.py` / `service.py` / `tests/`.

| Capability | Default backend | Local path (under `LOCAL_MODELS_ROOT`) | Other |
| ---------- | --------------- | ---------------------------------------- | ----- |
| Image      | `qwen`          | `image/models/Qwen-Image`                | `IMAGE_BACKEND=sd` + `SD_MODEL` / `IMAGE_MODEL` |

## Setup

```bash
cd python_ml/image-playground
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8003
```

## API

- `POST /api/v1/images:generate` → `{ job_id }`
- `GET /api/v1/imageJobs/{image_job}` → `{ status, image_url? }`
- `GET /output/image/{job_id}.png`

Consumers: `IMAGE_PLAYGROUND_API_URL=http://localhost:8003`.

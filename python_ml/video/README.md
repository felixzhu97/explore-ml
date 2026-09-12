# Video

Local loopback video generation (CogVideoX). Plain **Video** name — Apple has no
Image Playground–style generative video API. Port: **8005**.

## Setup

```bash
cd python_ml/video
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8005
```

## API

- `POST /api/v1/videos:generate` → `{ job_id }`
- `GET /api/v1/videoJobs/{video_job}` → `{ status, video_url? }`
- `GET /output/video/{job_id}.mp4`

Consumers: `VIDEO_API_URL=http://localhost:8005`.

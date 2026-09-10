# Media Gen (Image + Video + Voice + ASR)

Layout (same as other Python helpers): `main.py` / `config.py` / `api.py` /
`service.py` / `domain/` / `tests/`.

Single service for image generation, video generation (CogVideoX), voice
synthesis, and speech recognition (ASR). Port: 8003.

**Defaults use downloaded local weights** under `LOCAL_MODELS_ROOT` (see
[Model Download Guide](../../docs/user-guide/model-download.md)). Set backends
to switch to Hugging Face / edge-tts.

| Capability | Default backend | Local path (under `LOCAL_MODELS_ROOT`) | Other |
| ---------- | --------------- | ---------------------------------------- | ----- |
| Image      | `qwen`          | `image/models/Qwen-Image`                | `IMAGE_BACKEND=sd` + `SD_MODEL` / `IMAGE_MODEL` |
| Voice      | `qwen`          | `tts/models/Qwen3-TTS-12Hz-1.7B-CustomVoice` | `VOICE_BACKEND=edge` + `EDGE_TTS_VOICE` |
| ASR        | `qwen`          | `asr/models/Qwen3-ASR-1.7B`              | `ASR_MODEL` (path or HF id) |
| Video      | CogVideoX HF id | —                                        | `COGVIDEOX_MODEL` |

## Setup

```bash
cd python_ml/media-gen
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8003
# or: python main.py
```

## Env (optional)

- `LOCAL_MODELS_ROOT` (default: `$HOME/Codes/models`; download guide in docs)
- `IMAGE_BACKEND` (`qwen` \| `sd`, default: `qwen`)
- `IMAGE_MODEL` / `SD_MODEL` (override model id or path)
- `VOICE_BACKEND` (`qwen` \| `edge`, default: `qwen`)
- `TTS_MODEL` / `TTS_SPEAKER` / `TTS_LANGUAGE` (Qwen TTS)
- `EDGE_TTS_VOICE` (when `VOICE_BACKEND=edge`)
- `ASR_BACKEND` (`qwen`, default)
- `ASR_MODEL` / `ASR_LANGUAGE` (Qwen ASR)
- `MEDIA_GEN_PORT` (default: 8003)
- `MEDIA_GEN_BASE_URL` (default: `http://localhost:{PORT}`)
- `MEDIA_OUTPUT_DIR` (default: `output`)
- `MEDIA_GEN_DEVICE` (default: auto; set `cpu` to force CPU)
- `COGVIDEOX_MODEL` (default: `THUDM/CogVideoX-2b`)
- `MEDIA_VIDEO_FORCE_LOCAL` (set `1` to try local video on macOS)

Example — Stable Diffusion + edge-tts instead of local Qwen:

```bash
export IMAGE_BACKEND=sd
export SD_MODEL=runwayml/stable-diffusion-v1-5
export VOICE_BACKEND=edge
```

## API

- **Image**: `POST /api/v1/images:generate` → `{ job_id }`;
  `GET /api/v1/imageJobs/{image_job}` → `{ status, image_url? }`;
  `GET /output/image/{job_id}.png`
- **Video**: `POST /api/v1/videos:generate` → `{ job_id }`;
  `GET /api/v1/videoJobs/{video_job}` → `{ status, video_url? }`;
  `GET /output/video/{job_id}.mp4`
- **Voice**: `POST /api/v1/voices:synthesize` body `{ text }` → `{ audio_url }`
  (`.wav` for Qwen, `.mp3` for edge-tts)
- **ASR (batch)**: `POST /api/v1/audios:transcribe` multipart `file` (+ optional
  form `language`) → `{ text, language? }`
- **ASR (streaming)**: `WS /ws/v1/audios:transcribe` — PCM/WAV base64 chunks;
  server replies `partial` / `final` / `error`. Default backend is a **rolling
  buffer** over local Qwen3-ASR (Mac/MPS-friendly). Set `ASR_STREAM_BACKEND=vllm`
  on CUDA for native streaming when available
  ([Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)).

```bash
curl -s -X POST "http://localhost:8003/api/v1/audios:transcribe" \
  -F "file=@sample.wav" \
  -F "language=Chinese"
```

Streaming message shapes:

```json
// client → server
{"type":"audio","data":"<base64 pcm|wav>","sample_rate":16000}
{"type":"commit"}
{"type":"stop"}

// server → client
{"type":"partial","text":"…"}
{"type":"final","text":"…"}
{"type":"error","text":"…"}
```

Optional stream env: `ASR_STREAM_BACKEND`, `ASR_STREAM_PARTIAL_INTERVAL_SEC`,
`ASR_STREAM_MIN_PARTIAL_BYTES`.

Server: set `MEDIA_GENERATION_API_URL=http://localhost:8003` in
application.yml `chat.upstreams.media-gen`.
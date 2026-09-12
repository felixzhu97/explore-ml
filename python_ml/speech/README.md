# Speech (ASR + TTS)

Local loopback speech recognition and synthesis, named after Apple
[Speech](https://developer.apple.com/documentation/speech) and
[AVSpeechSynthesizer](https://developer.apple.com/documentation/avfaudio/avspeechsynthesizer).
Port: **8004**.

| Capability | Default backend | Local path (under `LOCAL_MODELS_ROOT`) | Other |
| ---------- | --------------- | ---------------------------------------- | ----- |
| Voice/TTS  | `qwen`          | `tts/models/Qwen3-TTS-12Hz-1.7B-CustomVoice` | `VOICE_BACKEND=edge` |
| ASR        | `qwen`          | `asr/models/Qwen3-ASR-1.7B`              | streaming WS |

## Setup

```bash
cd python_ml/speech
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8004
```

## API

- **TTS**: `POST /api/v1/voices:synthesize` → `{ audio_url }`
- **ASR batch**: `POST /api/v1/audios:transcribe`
- **ASR stream**: `WS /ws/v1/audios:transcribe`

Consumers: `SPEECH_API_URL=http://localhost:8004`.

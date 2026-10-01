# Speech (ASR + TTS)

Local loopback speech recognition and synthesis, named after Apple
[Speech](https://developer.apple.com/documentation/speech) and
[AVSpeechSynthesizer](https://developer.apple.com/documentation/avfaudio/avspeechsynthesizer).
Port: **8004** (`SPEECH_PORT`, then `PORT`).

Layout (same as other Python helpers): `main.py` / `config.py` / `controller/` /
`service/` / `domain/` / `infra/` / `tests/` / `training/`.

| Capability | Default backend | Local path (under `LOCAL_MODELS_ROOT`)        | Other                   |
| ---------- | --------------- | --------------------------------------------- | ----------------------- |
| Voice/TTS  | `qwen`          | `tts/models/Qwen3-TTS-12Hz-1.7B-CustomVoice`  | `VOICE_BACKEND=edge`    |
| ASR        | `qwen`          | `asr/models/Qwen3-ASR-1.7B`                   | streaming over WebSocket |

## Setup

```bash
cd python_ml/speech
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8004
```

This helper does not load `.env`; export the variables from `.env.example` in
your shell. Models load lazily on the first request.

## API

There is no `/health` route; use `GET /openapi.json` as a liveness check.

- **TTS**: `POST /api/v1/voices:synthesize` with `{text, voice?}` →
  `{audio_url}`. The file is ready when the call returns: `.wav` with the Qwen
  backend, `.mp3` with Edge. Empty text returns 400.
- **Audio files**: `GET /output/voice/{job_id}.wav` or `.mp3`.
- **ASR batch**: `POST /api/v1/audios:transcribe`, multipart `file` plus an
  optional `language` form field → `{text, language?}`. Accepted suffixes:
  `.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`, `.webm`, `.aac`.
- **ASR stream**: `WS /ws/v1/audios:transcribe`.

  | Direction | Message |
  | --------- | ------- |
  | client → server | `{"type": "audio", "data": "<base64 pcm16 or wav>", "sample_rate": 16000}` |
  | client → server | `{"type": "commit"}` (finalize the current utterance) or `{"type": "stop"}` |
  | server → client | `{"type": "partial" \| "final" \| "error", "text": "..."}` |

  `StreamingTranscriptionSession` (`infra/streaming_transcription.py`) keeps a
  rolling buffer and re-transcribes it at most every
  `ASR_STREAM_PARTIAL_INTERVAL_SEC` once `ASR_STREAM_MIN_PARTIAL_BYTES` have
  arrived.

## Configuration

| Variable | Default |
| -------- | ------- |
| `SPEECH_HOST` / `SPEECH_PORT` / `SPEECH_BASE_URL` | `0.0.0.0` / `8004` / `http://localhost:<port>` |
| `SPEECH_OUTPUT_DIR` | `output` |
| `SPEECH_DEVICE=cpu` | force CPU |
| `VOICE_BACKEND` | `qwen` (or `edge`) |
| `TTS_MODEL` / `TTS_LANGUAGE` / `TTS_SPEAKER` | local Qwen3-TTS / `Chinese` / (empty) |
| `EDGE_TTS_VOICE` | `zh-CN-XiaoxiaoNeural` |
| `ASR_BACKEND` | `qwen` (the only working backend) |
| `ASR_MODEL` / `ASR_LANGUAGE` | local Qwen3-ASR / auto |
| `ASR_STREAM_PARTIAL_INTERVAL_SEC` / `ASR_STREAM_MIN_PARTIAL_BYTES` | `1.0` / `32000` |
| `LOCAL_MODELS_ROOT` | `~/Codes/models` |
| `HF_ENDPOINT` | `https://hf-mirror.com` when unset |

`ASR_STREAM_BACKEND` is defined but not read yet.

## Fine-tuning

`training/train_asr.py` and `training/train_tts.py` run the upstream Qwen3-ASR
and Qwen3-TTS recipes on Hugging Face Jobs and push the final checkpoint. Point
`ASR_MODEL`, or `TTS_MODEL` plus `TTS_SPEAKER`, at the downloaded directory.
`python -m training.eval_wer` compares the WER (CER for CJK) of the fine-tuned
and base ASR checkpoints. See the
[fine-tuning guide](../../docs/user-guide/fine-tuning.md).

## Tests

```bash
pytest -q   # test_health.py, test_fine_tuning.py, test_local_models_config.py,
            # test_streaming_transcription.py, test_transcription_api.py
```

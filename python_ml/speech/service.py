from __future__ import annotations

import os
import threading

import config

tts_model = None
asr_model = None
pipe_lock = threading.Lock()


def _device():
    import torch

    if os.environ.get("SPEECH_DEVICE") == "cpu":
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def get_tts_model():
    global tts_model
    with pipe_lock:
        if tts_model is None:
            import torch
            from qwen_tts import Qwen3TTSModel

            device = _device()
            dtype = torch.float16 if device in ("mps", "cuda") else torch.float32
            tts_model = Qwen3TTSModel.from_pretrained(
                config.TTS_MODEL,
                device_map=device,
                dtype=dtype,
            )
    return tts_model


def get_asr_model():
    global asr_model
    with pipe_lock:
        if asr_model is None:
            if config.ASR_BACKEND != "qwen":
                raise RuntimeError(
                    f"Unsupported ASR_BACKEND={config.ASR_BACKEND!r}; use qwen"
                )
            import torch
            from qwen_asr import Qwen3ASRModel

            device = _device()
            if device == "mps":
                dtype = torch.float16
            elif device == "cuda":
                dtype = torch.bfloat16
            else:
                dtype = torch.float32
            asr_model = Qwen3ASRModel.from_pretrained(
                config.ASR_MODEL,
                dtype=dtype,
                device_map=device,
                max_inference_batch_size=1,
                max_new_tokens=512,
            )
    return asr_model


def _transcribe_qwen(audio_path: str, language: str | None) -> dict:
    asr = get_asr_model()
    lang = language or config.ASR_LANGUAGE or None
    results = asr.transcribe(audio=audio_path, language=lang or None)
    if not results:
        return {"text": "", "language": lang or ""}
    first = results[0]
    text = getattr(first, "text", None)
    if text is None and isinstance(first, dict):
        text = first.get("text", "")
    if text is None:
        text = str(first)
    detected = getattr(first, "language", None)
    if detected is None and isinstance(first, dict):
        detected = first.get("language", "")
    return {"text": text or "", "language": detected or lang or ""}


async def transcribe_audio(audio_path: str, language: str | None = None) -> dict:
    import asyncio

    return await asyncio.to_thread(_transcribe_qwen, audio_path, language)


def _synthesize_qwen_voice(text: str, speaker: str, out_path) -> None:
    import numpy as np
    import soundfile as sf
    import torch

    tts = get_tts_model()
    speakers = tts.get_supported_speakers()
    chosen = speaker or config.TTS_SPEAKER or (speakers[0] if speakers else "vivian")
    waves, sr = tts.generate_custom_voice(
        text=text,
        speaker=chosen,
        language=config.TTS_LANGUAGE,
        non_streaming_mode=True,
    )
    audio = waves[0]
    if isinstance(audio, torch.Tensor):
        audio = audio.detach().cpu().numpy()
    audio = np.asarray(audio, dtype=np.float32)
    sf.write(str(out_path), audio, sr)


async def synthesize_voice(text: str, voice: str, job_id: str, out_path):
    if config.VOICE_BACKEND == "edge":
        import edge_tts

        communicate = edge_tts.Communicate(text, voice or config.DEFAULT_VOICE)
        await communicate.save(str(out_path))
        return

    import asyncio

    await asyncio.to_thread(_synthesize_qwen_voice, text, voice or "", out_path)

from __future__ import annotations

import os
import threading

import config

synthesis_model = None
transcription_model = None
model_lock = threading.Lock()


def _select_device() -> str:
    import torch

    if os.environ.get("SPEECH_DEVICE") == "cpu":
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    mps_backend = getattr(torch.backends, "mps", None)
    if mps_backend is not None and mps_backend.is_available():
        return "mps"
    return "cpu"


def get_synthesis_model():
    global synthesis_model
    with model_lock:
        if synthesis_model is None:
            import torch
            from qwen_tts import Qwen3TTSModel

            device = _select_device()
            dtype = torch.float16 if device in ("mps", "cuda") else torch.float32
            synthesis_model = Qwen3TTSModel.from_pretrained(
                config.TTS_MODEL,
                device_map=device,
                dtype=dtype,
            )
    return synthesis_model


def get_transcription_model():
    global transcription_model
    with model_lock:
        if transcription_model is None:
            if config.ASR_BACKEND != "qwen":
                raise RuntimeError(
                    f"Unsupported ASR_BACKEND={config.ASR_BACKEND!r}; use qwen"
                )
            import torch
            from qwen_asr import Qwen3ASRModel

            device = _select_device()
            if device == "mps":
                dtype = torch.float16
            elif device == "cuda":
                dtype = torch.bfloat16
            else:
                dtype = torch.float32
            transcription_model = Qwen3ASRModel.from_pretrained(
                config.ASR_MODEL,
                dtype=dtype,
                device_map=device,
                max_inference_batch_size=1,
                max_new_tokens=512,
            )
    return transcription_model


def _field(result, name: str) -> str | None:
    value = getattr(result, name, None)
    if value is None and isinstance(result, dict):
        value = result.get(name, "")
    return value


def transcribe(audio_path: str, language: str | None) -> dict:
    model = get_transcription_model()
    language = language or config.ASR_LANGUAGE or None
    results = model.transcribe(audio=audio_path, language=language)
    if not results:
        return {"text": "", "language": language or ""}
    first_result = results[0]
    text = _field(first_result, "text")
    if text is None:
        text = str(first_result)
    detected_language = _field(first_result, "language")
    return {"text": text or "", "language": detected_language or language or ""}


def synthesize_qwen(text: str, speaker: str, output_path) -> None:
    import numpy
    import soundfile
    import torch

    model = get_synthesis_model()
    supported_speakers = model.get_supported_speakers()
    chosen_speaker = (
        speaker
        or config.TTS_SPEAKER
        or (supported_speakers[0] if supported_speakers else "vivian")
    )
    waveforms, sample_rate = model.generate_custom_voice(
        text=text,
        speaker=chosen_speaker,
        language=config.TTS_LANGUAGE,
        non_streaming_mode=True,
    )
    audio = waveforms[0]
    if isinstance(audio, torch.Tensor):
        audio = audio.detach().cpu().numpy()
    soundfile.write(str(output_path), numpy.asarray(audio, dtype=numpy.float32), sample_rate)


async def synthesize_edge(text: str, voice: str, output_path) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output_path))

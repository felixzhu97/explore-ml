import asyncio
from pathlib import Path

import config
from infra import models
from infra.streaming_asr import StreamingAsrSession


def voice_path(job_id: str, ext: str) -> Path:
    return config.VOICE_OUTPUT / f"{job_id}.{ext}"


def upload_path(job_id: str, suffix: str) -> Path:
    return config.ASR_UPLOADS / f"{job_id}{suffix}"


def default_voice(voice: str | None) -> str:
    if config.VOICE_BACKEND == "edge":
        return (voice or config.DEFAULT_VOICE).strip()
    return (voice or config.TTS_SPEAKER or "").strip()


async def transcribe_audio(audio_path: str, language: str | None = None) -> dict:
    return await asyncio.to_thread(models.transcribe, audio_path, language)


async def synthesize_voice(text: str, voice: str, out_path) -> None:
    if config.VOICE_BACKEND == "edge":
        await models.synthesize_edge(text, voice or config.DEFAULT_VOICE, out_path)
        return
    await asyncio.to_thread(models.synthesize_qwen, text, voice or "", out_path)


def new_stream_session() -> StreamingAsrSession:
    return StreamingAsrSession(
        transcribe_fn=models.transcribe,
        sample_rate=16000,
        language=(config.ASR_LANGUAGE or None) or None,
        partial_interval_sec=config.ASR_STREAM_PARTIAL_INTERVAL_SEC,
        min_partial_bytes=config.ASR_STREAM_MIN_PARTIAL_BYTES,
        uploads_dir=config.ASR_UPLOADS,
    )

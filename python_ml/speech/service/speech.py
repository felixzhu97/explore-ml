"""Speech use cases: speech synthesis, file transcription and streaming sessions."""

import asyncio
from functools import lru_cache
from pathlib import Path

from speech import config
from speech.infra import models
from speech.infra.streaming_transcription import StreamingTranscriptionSession

STREAM_SAMPLE_RATE = 16000


class SpeechService:
    def voice_path(self, job_id: str, extension: str) -> Path:
        return config.VOICE_OUTPUT / f"{job_id}.{extension}"

    def upload_path(self, job_id: str, suffix: str) -> Path:
        return config.ASR_UPLOADS / f"{job_id}{suffix}"

    def default_voice(self, voice: str | None) -> str:
        if config.VOICE_BACKEND == "edge":
            return (voice or config.DEFAULT_VOICE).strip()
        return (voice or config.TTS_SPEAKER or "").strip()

    async def transcribe_audio(self, audio_path: str, language: str | None = None) -> dict:
        return await asyncio.to_thread(models.transcribe, audio_path, language)

    async def synthesize_voice(self, text: str, voice: str, output_path: Path) -> None:
        if config.VOICE_BACKEND == "edge":
            await models.synthesize_edge(text, voice or config.DEFAULT_VOICE, output_path)
            return
        await asyncio.to_thread(models.synthesize_qwen, text, voice or "", output_path)

    def new_stream_session(self) -> StreamingTranscriptionSession:
        return StreamingTranscriptionSession(
            transcribe=models.transcribe,
            sample_rate=STREAM_SAMPLE_RATE,
            language=config.ASR_LANGUAGE or None,
            partial_interval_sec=config.ASR_STREAM_PARTIAL_INTERVAL_SEC,
            min_partial_bytes=config.ASR_STREAM_MIN_PARTIAL_BYTES,
            uploads_dir=config.ASR_UPLOADS,
        )


@lru_cache
def get_speech_service() -> SpeechService:
    return SpeechService()

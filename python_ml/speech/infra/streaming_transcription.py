"""Incremental streaming transcription over local Qwen3-ASR (rolling buffer)."""

from __future__ import annotations

import base64
import io
import tempfile
import time
import wave
from collections.abc import Callable
from pathlib import Path

PCM16_BYTES_PER_SAMPLE = 2

TranscribeFunction = Callable[[str, str | None], dict]


def pcm16_le_to_wav_bytes(pcm: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap mono PCM s16le as a WAV container for file-based ASR backends."""
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(PCM16_BYTES_PER_SAMPLE)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm)
    return wav_buffer.getvalue()


def decode_audio_payload(payload: str) -> bytes:
    """Decode base64 PCM, a data URL or WAV bytes to raw audio frames."""
    encoded = payload.strip()
    if encoded.startswith("data:") and "," in encoded:
        encoded = encoded.split(",", 1)[1]
    audio_bytes = base64.b64decode(encoded)
    if len(audio_bytes) >= 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
            return wav_file.readframes(wav_file.getnframes())
    return audio_bytes


class StreamingTranscriptionSession:
    """
    Rolling-buffer transcription session.

    Emits ``partial`` after enough new audio or wall time, and ``final`` on
    commit / stop. Takes an injectable ``transcribe(path, language) -> dict``
    so tests can avoid loading Qwen weights.
    """

    def __init__(
        self,
        *,
        transcribe: TranscribeFunction,
        sample_rate: int = 16000,
        language: str | None = None,
        partial_interval_sec: float = 1.0,
        min_partial_bytes: int = 16000 * PCM16_BYTES_PER_SAMPLE,
        uploads_dir: Path | None = None,
    ) -> None:
        self._transcribe = transcribe
        self.sample_rate = sample_rate
        self.language = language
        self.partial_interval_sec = partial_interval_sec
        self.min_partial_bytes = min_partial_bytes
        self.uploads_dir = uploads_dir
        self._pcm = bytearray()
        self._last_partial_at = 0.0
        self._last_partial_text = ""
        self._closed = False

    @property
    def closed(self) -> bool:
        return self._closed

    def append_audio(self, base64_audio: str, sample_rate: int | None = None) -> dict | None:
        """Append a base64 audio chunk; may return a partial event dict."""
        if self._closed:
            return {"type": "error", "text": "session closed"}
        if sample_rate and sample_rate != self.sample_rate:
            self.sample_rate = int(sample_rate)
        try:
            pcm = decode_audio_payload(base64_audio)
        except Exception as error:  # noqa: BLE001 — protocol error to client
            return {"type": "error", "text": f"invalid audio data: {error}"}
        if not pcm:
            return None
        self._pcm.extend(pcm)
        now = time.monotonic()
        enough_bytes = len(self._pcm) >= self.min_partial_bytes
        enough_time = (now - self._last_partial_at) >= self.partial_interval_sec
        if enough_bytes and enough_time:
            return self._emit_partial()
        return None

    def commit(self) -> dict:
        """Finalize current turn and clear the buffer."""
        if self._closed:
            return {"type": "error", "text": "session closed"}
        if not self._pcm:
            return {"type": "final", "text": ""}
        text = self._transcribe_buffer()
        self._pcm.clear()
        self._last_partial_text = ""
        self._last_partial_at = 0.0
        return {"type": "final", "text": text}

    def stop(self) -> dict:
        """Commit remaining audio and close the session."""
        event = self.commit()
        self._closed = True
        return event

    def _emit_partial(self) -> dict | None:
        text = self._transcribe_buffer()
        self._last_partial_at = time.monotonic()
        if text == self._last_partial_text:
            return None
        self._last_partial_text = text
        return {"type": "partial", "text": text}

    def _transcribe_buffer(self) -> str:
        wav_bytes = pcm16_le_to_wav_bytes(bytes(self._pcm), self.sample_rate)
        if self.uploads_dir is not None:
            self.uploads_dir.mkdir(parents=True, exist_ok=True)
            wav_path = self.uploads_dir / f"stream-{id(self)}-{time.time_ns()}.wav"
            wav_path.write_bytes(wav_bytes)
            try:
                result = self._transcribe(str(wav_path), self.language)
            finally:
                try:
                    wav_path.unlink(missing_ok=True)
                except OSError:
                    pass
        else:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as wav_file:
                wav_file.write(wav_bytes)
                wav_file.flush()
                result = self._transcribe(wav_file.name, self.language)
        return (result or {}).get("text", "") or ""

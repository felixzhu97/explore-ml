"""Incremental streaming ASR session over local Qwen3-ASR (rolling buffer)."""

from __future__ import annotations

import base64
import io
import tempfile
import time
import wave
from pathlib import Path
from typing import Callable, Optional


def pcm16_le_to_wav_bytes(pcm: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap mono PCM s16le as a WAV container for file-based ASR backends."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def decode_audio_payload(data: str) -> bytes:
    """Decode base64 PCM or data-URL / raw WAV bytes to PCM s16le when possible."""
    raw = data.strip()
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    blob = base64.b64decode(raw)
    if len(blob) >= 12 and blob[:4] == b"RIFF" and blob[8:12] == b"WAVE":
        with wave.open(io.BytesIO(blob), "rb") as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
                frames = wf.readframes(wf.getnframes())
                # Best-effort: if already mono s16, return frames; else leave as-is
                if wf.getnchannels() == 1 and wf.getsampwidth() == 2:
                    return frames
                return frames
            return wf.readframes(wf.getnframes())
    return blob


class StreamingAsrSession:
    """
    Rolling-buffer ASR session.

    Emits ``partial`` after enough new audio or wall time, and ``final`` on
    commit / stop. Uses a injectable ``transcribe_fn(path, language) -> dict``
    so tests can avoid loading Qwen weights.
    """

    def __init__(
        self,
        *,
        transcribe_fn: Callable[[str, Optional[str]], dict],
        sample_rate: int = 16000,
        language: Optional[str] = None,
        partial_interval_sec: float = 1.0,
        min_partial_bytes: int = 16000 * 2,  # ~1s of PCM16 mono
        uploads_dir: Optional[Path] = None,
    ) -> None:
        self._transcribe_fn = transcribe_fn
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

    def append_audio(self, data_b64: str, sample_rate: Optional[int] = None) -> Optional[dict]:
        """Append a base64 audio chunk; may return a partial event dict."""
        if self._closed:
            return {"type": "error", "text": "session closed"}
        if sample_rate and sample_rate != self.sample_rate:
            self.sample_rate = int(sample_rate)
        try:
            pcm = decode_audio_payload(data_b64)
        except Exception as exc:  # noqa: BLE001 — protocol error to client
            return {"type": "error", "text": f"invalid audio data: {exc}"}
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

    def _emit_partial(self) -> Optional[dict]:
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
            path = self.uploads_dir / f"stream-{id(self)}-{time.time_ns()}.wav"
            path.write_bytes(wav_bytes)
            try:
                result = self._transcribe_fn(str(path), self.language)
            finally:
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass
        else:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
                tmp.write(wav_bytes)
                tmp.flush()
                result = self._transcribe_fn(tmp.name, self.language)
        return (result or {}).get("text", "") or ""

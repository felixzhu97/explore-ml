"""Audio rules: accepted upload types and speech job ids."""

import uuid
from pathlib import Path

ALLOWED_AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm", ".aac"}


def audio_suffix(filename: str | None) -> str:
    return Path(filename or "audio.wav").suffix.lower() or ".wav"


def is_allowed_audio(suffix: str) -> bool:
    return suffix in ALLOWED_AUDIO_SUFFIXES


def new_job_id() -> str:
    return f"job-{uuid.uuid4().hex[:12]}"

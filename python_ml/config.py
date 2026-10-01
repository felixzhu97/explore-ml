"""Process settings for the single Explore ML app (one host, one port)."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

MODULE_NAMES = ("recommendation", "vision", "rag", "image_playground", "speech", "video")

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))


def enabled_modules(value: str | None = None) -> tuple[str, ...]:
    """Modules named in EXPLORE_MODULES (comma separated); every module when unset."""
    raw = os.getenv("EXPLORE_MODULES", "") if value is None else value
    names = tuple(name.strip() for name in raw.split(",") if name.strip())
    unknown = sorted(set(names) - set(MODULE_NAMES))
    if unknown:
        raise ValueError(f"Unknown module(s) in EXPLORE_MODULES: {', '.join(unknown)}")
    return tuple(name for name in MODULE_NAMES if name in names) if names else MODULE_NAMES

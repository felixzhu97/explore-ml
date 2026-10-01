"""Outcome of syncing database records into the vector store."""

from dataclasses import dataclass, field


@dataclass
class SyncResult:
    total: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    duration_ms: int = 0

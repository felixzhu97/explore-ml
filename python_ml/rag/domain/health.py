"""Health and readiness of the RAG backing services."""

from dataclasses import dataclass


@dataclass(frozen=True)
class HealthReport:
    services: dict[str, bool]

    @property
    def status(self) -> str:
        return "healthy" if all(self.services.values()) else "degraded"


@dataclass(frozen=True)
class Readiness:
    ready: bool
    reason: str | None = None

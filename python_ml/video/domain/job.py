"""Generation job lifecycle: pending, then succeeded or failed."""

import threading
import uuid
from dataclasses import dataclass, replace
from enum import StrEnum


class JobStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass(frozen=True)
class Job:
    id: str
    status: JobStatus = JobStatus.PENDING
    url: str | None = None
    error: str | None = None


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self) -> Job:
        job = Job(id=f"job-{uuid.uuid4().hex[:12]}")
        with self._lock:
            self._jobs[job.id] = job
        return job

    def succeed(self, job_id: str, url: str) -> None:
        self._update(job_id, status=JobStatus.SUCCEEDED, url=url)

    def fail(self, job_id: str, error: str) -> None:
        self._update(job_id, status=JobStatus.FAILED, error=error)

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def _update(self, job_id: str, **changes: object) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id] = replace(self._jobs[job_id], **changes)

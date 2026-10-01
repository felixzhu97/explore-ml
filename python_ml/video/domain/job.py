"""Generation job lifecycle: pending, then succeeded or failed."""

import threading
import uuid
from typing import Optional

PENDING = "pending"
SUCCEEDED = "succeeded"
FAILED = "failed"


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self) -> str:
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        with self._lock:
            self._jobs[job_id] = {"status": PENDING}
        return job_id

    def succeed(self, job_id: str, url: str) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].update(status=SUCCEEDED, url=url)

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].update(status=FAILED, error=error)

    def get(self, job_id: str) -> Optional[dict]:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

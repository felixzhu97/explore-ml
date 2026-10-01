"""Image generation jobs: create, run in the background, look up, locate output."""

from functools import lru_cache
from pathlib import Path

from image_playground import config
from image_playground.domain.job import Job, JobStore
from image_playground.infra import pipeline


class ImageService:
    def __init__(self, job_store: JobStore) -> None:
        self._job_store = job_store

    def output_path(self, job_id: str) -> Path:
        return config.IMAGE_OUTPUT / f"{job_id}.png"

    def create_job(self) -> Job:
        return self._job_store.create()

    def get_job(self, job_id: str) -> Job | None:
        return self._job_store.get(job_id)

    def run_job(self, job_id: str, prompt: str, negative_prompt: str) -> None:
        try:
            pipeline.generate(prompt, negative_prompt, self.output_path(job_id))
            self._job_store.succeed(job_id, f"{config.BASE_URL}/output/image/{job_id}.png")
        except Exception as error:
            self._job_store.fail(job_id, str(error))


@lru_cache
def get_image_service() -> ImageService:
    return ImageService(JobStore())

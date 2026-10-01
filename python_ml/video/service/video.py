"""Video generation jobs: warm the pipeline, run jobs in the background, locate output."""

from functools import lru_cache
from pathlib import Path

from video import config
from video.domain.job import Job, JobStore
from video.infra import pipeline

UNSUPPORTED_PLATFORM = (
    "Local video generation not supported on this platform. "
    "Set VIDEO_FORCE_LOCAL=1 to try anyway."
)


class VideoService:
    def __init__(self, job_store: JobStore) -> None:
        self._job_store = job_store

    def startup(self) -> None:
        if not pipeline.skip_video_local():
            pipeline.get_video_pipeline()

    def output_path(self, job_id: str) -> Path:
        return config.VIDEO_OUTPUT / f"{job_id}.mp4"

    def create_job(self) -> Job:
        return self._job_store.create()

    def get_job(self, job_id: str) -> Job | None:
        return self._job_store.get(job_id)

    def run_job(self, job_id: str, prompt: str) -> None:
        try:
            if not pipeline.generate(prompt, self.output_path(job_id)):
                self._job_store.fail(job_id, UNSUPPORTED_PLATFORM)
                return
            self._job_store.succeed(job_id, f"{config.BASE_URL}/output/video/{job_id}.mp4")
        except Exception as error:
            self._job_store.fail(job_id, str(error))


@lru_cache
def get_video_service() -> VideoService:
    return VideoService(JobStore())

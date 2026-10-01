from pathlib import Path
from typing import Optional

import config
from domain.job import JobStore
from infra import pipeline

jobs = JobStore()

UNSUPPORTED_PLATFORM = (
    "Local video generation not supported on this platform. "
    "Set VIDEO_FORCE_LOCAL=1 to try anyway."
)


def startup() -> None:
    if not pipeline.skip_video_local():
        pipeline.get_video_pipeline()


def output_path(job_id: str) -> Path:
    return config.VIDEO_OUTPUT / f"{job_id}.mp4"


def create_job() -> str:
    return jobs.create()


def get_job(job_id: str) -> Optional[dict]:
    return jobs.get(job_id)


def run_video_job(job_id: str, prompt: str) -> None:
    try:
        if not pipeline.generate(prompt, output_path(job_id)):
            jobs.fail(job_id, UNSUPPORTED_PLATFORM)
            return
        jobs.succeed(job_id, f"{config.BASE_URL}/output/video/{job_id}.mp4")
    except Exception as e:
        jobs.fail(job_id, str(e))

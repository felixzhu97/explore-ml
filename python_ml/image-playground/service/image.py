from pathlib import Path
from typing import Optional

import config
from domain.job import JobStore
from infra import pipeline

jobs = JobStore()


def output_path(job_id: str) -> Path:
    return config.IMAGE_OUTPUT / f"{job_id}.png"


def create_job() -> str:
    return jobs.create()


def get_job(job_id: str) -> Optional[dict]:
    return jobs.get(job_id)


def run_image_job(job_id: str, prompt: str, negative_prompt: str) -> None:
    try:
        pipeline.generate(prompt, negative_prompt, output_path(job_id))
        jobs.succeed(job_id, f"{config.BASE_URL}/output/image/{job_id}.png")
    except Exception as e:
        jobs.fail(job_id, str(e))

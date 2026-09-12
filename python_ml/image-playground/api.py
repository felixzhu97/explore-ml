import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import config
import service

router = APIRouter()


class ImageGenerateBody(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None


@router.post("/api/v1/images:generate")
def image_generate(body: ImageGenerateBody, background_tasks: BackgroundTasks):
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    with service.jobs_lock:
        service.image_jobs[job_id] = {"status": "pending"}
    background_tasks.add_task(
        service.run_image_job,
        job_id,
        body.prompt,
        body.negative_prompt or "",
    )
    return {"job_id": job_id}


@router.get("/api/v1/imageJobs/{image_job}")
def image_get_result(image_job: str):
    with service.jobs_lock:
        job = service.image_jobs.get(image_job)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "name": f"imageJobs/{image_job}",
        "status": job["status"],
        **({"image_url": job["image_url"]} if job.get("image_url") else {}),
        **({"error": job["error"]} if job.get("error") else {}),
    }


@router.get("/output/image/{job_id}.png")
def serve_image(job_id: str):
    path = config.IMAGE_OUTPUT / f"{job_id}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="image/png")

import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import config
import service

router = APIRouter()


class VideoGenerateBody(BaseModel):
    prompt: str
    image_url: Optional[str] = None


@router.post("/api/v1/videos:generate")
def video_generate(body: VideoGenerateBody, background_tasks: BackgroundTasks):
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    with service.jobs_lock:
        service.video_jobs[job_id] = {"status": "pending"}
    background_tasks.add_task(service.run_video_job, job_id, body.prompt)
    return {"job_id": job_id}


@router.get("/api/v1/videoJobs/{video_job}")
def video_get_result(video_job: str):
    with service.jobs_lock:
        job = service.video_jobs.get(video_job)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "name": f"videoJobs/{video_job}",
        "status": job["status"],
        **({"video_url": job["video_url"]} if job.get("video_url") else {}),
        **({"error": job["error"]} if job.get("error") else {}),
    }


@router.get("/output/video/{job_id}.mp4")
def serve_video(job_id: str):
    path = config.VIDEO_OUTPUT / f"{job_id}.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="video/mp4")

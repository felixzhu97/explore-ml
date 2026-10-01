from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from video.service.video import VideoService, get_video_service

router = APIRouter()

VideoServiceDependency = Annotated[VideoService, Depends(get_video_service)]


class GenerateVideoRequest(BaseModel):
    prompt: str
    image_url: str | None = None


class CreatedJobResponse(BaseModel):
    job_id: str


class VideoJobResponse(BaseModel):
    name: str
    status: str
    video_url: str | None = None
    error: str | None = None


@router.post("/api/v1/videos:generate")
def generate_video(
    request: GenerateVideoRequest,
    background_tasks: BackgroundTasks,
    video_service: VideoServiceDependency,
) -> CreatedJobResponse:
    job = video_service.create_job()
    background_tasks.add_task(video_service.run_job, job.id, request.prompt)
    return CreatedJobResponse(job_id=job.id)


@router.get("/api/v1/videoJobs/{video_job}", response_model_exclude_none=True)
def get_video_job(video_job: str, video_service: VideoServiceDependency) -> VideoJobResponse:
    job = video_service.get_job(video_job)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return VideoJobResponse(
        name=f"videoJobs/{video_job}", status=job.status, video_url=job.url, error=job.error
    )


@router.get("/output/video/{job_id}.mp4")
def serve_video(job_id: str, video_service: VideoServiceDependency) -> FileResponse:
    path = video_service.output_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="video/mp4")

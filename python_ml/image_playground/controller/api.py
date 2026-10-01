from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from image_playground.service.image import ImageService, get_image_service

router = APIRouter()

ImageServiceDependency = Annotated[ImageService, Depends(get_image_service)]


class GenerateImageRequest(BaseModel):
    prompt: str
    negative_prompt: str | None = None


class CreatedJobResponse(BaseModel):
    job_id: str


class ImageJobResponse(BaseModel):
    name: str
    status: str
    image_url: str | None = None
    error: str | None = None


@router.post("/api/v1/images:generate")
def generate_image(
    request: GenerateImageRequest,
    background_tasks: BackgroundTasks,
    image_service: ImageServiceDependency,
) -> CreatedJobResponse:
    job = image_service.create_job()
    background_tasks.add_task(
        image_service.run_job, job.id, request.prompt, request.negative_prompt or ""
    )
    return CreatedJobResponse(job_id=job.id)


@router.get("/api/v1/imageJobs/{image_job}", response_model_exclude_none=True)
def get_image_job(image_job: str, image_service: ImageServiceDependency) -> ImageJobResponse:
    job = image_service.get_job(image_job)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return ImageJobResponse(
        name=f"imageJobs/{image_job}", status=job.status, image_url=job.url, error=job.error
    )


@router.get("/output/image/{job_id}.png")
def serve_image(job_id: str, image_service: ImageServiceDependency) -> FileResponse:
    path = image_service.output_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="image/png")

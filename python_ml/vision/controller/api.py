import os
import tempfile
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from PIL import Image
from pydantic import BaseModel

import config
from domain.moderation import ModerationVerdict
from service.vision import VisionService, get_vision_service

router = APIRouter()

VisionServiceDependency = Annotated[VisionService, Depends(get_vision_service)]
OptionalUpload = Annotated[UploadFile | None, File()]

MAX_IMAGE_BYTES = 10 * 1024 * 1024


class PredictionResponse(BaseModel):
    labels: list[str]


class ModerationCategoryResponse(BaseModel):
    label: str
    score: float


class ModerationResponse(BaseModel):
    safe: bool
    categories: list[ModerationCategoryResponse] = []

    @classmethod
    def from_verdict(cls, result: ModerationVerdict) -> "ModerationResponse":
        return cls(
            safe=result.safe,
            categories=[
                ModerationCategoryResponse(label=category.label, score=category.score)
                for category in result.categories
            ],
        )


SAFE_RESPONSE = ModerationResponse(safe=True)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": "resnet50"}


async def _download(url: str, timeout_seconds: float, kind: str) -> bytes:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise HTTPException(status_code=400, detail=f"Failed to fetch {kind}: {error}")
    return response.content


async def _json_url(request: Request, field_name: str) -> str | None:
    if "application/json" not in (request.headers.get("content-type") or ""):
        return None
    body = await request.json()
    url = body.get(field_name) if isinstance(body, dict) else None
    if not url:
        raise HTTPException(status_code=400, detail=f"Missing {field_name}")
    return url


async def _load_image(
    request: Request, file: UploadFile | None, vision_service: VisionService
) -> Image.Image | None:
    if file and file.filename:
        content = await file.read()
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="Image too large")
        return vision_service.open_image_bytes(content)
    image_url = await _json_url(request, "image_url")
    if image_url is None:
        raise HTTPException(
            status_code=400,
            detail="Provide application/json with image_url or multipart file",
        )
    content = await _download(image_url, config.REQUEST_TIMEOUT, "image")
    return vision_service.open_image_bytes(content)


@router.post("/api/v1/images:predict")
async def predict_image(
    request: Request, vision_service: VisionServiceDependency, file: OptionalUpload = None
) -> PredictionResponse:
    image = await _load_image(request, file, vision_service)
    if image is None:
        return PredictionResponse(labels=[])
    try:
        return PredictionResponse(labels=vision_service.predict_image(image))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/api/v1/images:moderate")
async def moderate_image(
    request: Request, vision_service: VisionServiceDependency, file: OptionalUpload = None
) -> ModerationResponse:
    if not config.MODERATION_ENABLED:
        return SAFE_RESPONSE
    image = await _load_image(request, file, vision_service)
    if image is None:
        return SAFE_RESPONSE
    try:
        return ModerationResponse.from_verdict(vision_service.moderate_image(image))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


def _moderate_video_bytes(
    content: bytes, suffix: str, vision_service: VisionService
) -> ModerationResponse:
    if len(content) > config.MAX_VIDEO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Video too large")
    file_descriptor, video_path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(file_descriptor, content)
        os.close(file_descriptor)
        return ModerationResponse.from_verdict(vision_service.moderate_video(video_path))
    finally:
        if os.path.exists(video_path):
            os.unlink(video_path)


@router.post("/api/v1/videos:moderate")
async def moderate_video(
    request: Request, vision_service: VisionServiceDependency, file: OptionalUpload = None
) -> ModerationResponse:
    if not config.MODERATION_ENABLED:
        return SAFE_RESPONSE
    if file and file.filename:
        suffix = Path(file.filename).suffix or ".mp4"
        return _moderate_video_bytes(await file.read(), suffix, vision_service)
    video_url = await _json_url(request, "video_url")
    if video_url is None:
        raise HTTPException(
            status_code=400,
            detail="Provide application/json with video_url or multipart file",
        )
    content = await _download(video_url, config.REQUEST_TIMEOUT * 2, "video")
    return _moderate_video_bytes(content, ".mp4", vision_service)

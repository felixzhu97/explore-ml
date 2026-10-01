import io

from fastapi.testclient import TestClient
from PIL import Image

from vision.domain.moderation import FrameVerdict, ModerationCategory, verdict
from vision.domain.prediction import Prediction
from vision.service.vision import get_vision_service
from server import create_app

app = create_app(["vision"])


class FakeVisionService:
    def open_image_bytes(self, content):
        return Image.open(io.BytesIO(content))

    def thresholds(self):
        return {"nude": 0.5}

    def predict_image(self, image):
        return [Prediction("cat", 0.7), Prediction("dog", 0.2)]

    def moderate_image(self, image):
        return verdict(
            [ModerationCategory("nude", 0.4), ModerationCategory("nude", 0.9)],
            scores={"nude": 0.9, "prohibited": 0.1},
        )

    def moderate_video(self, video_path):
        return verdict(
            [ModerationCategory("nude", 0.8)],
            [
                FrameVerdict(offset_seconds=0.0, scores={"nude": 0.1}, safe=True),
                FrameVerdict(offset_seconds=1.0, scores={"nude": 0.8}, safe=False),
            ],
        )


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_should_keep_highest_score_per_label_when_moderating_upload():
    app.dependency_overrides[get_vision_service] = FakeVisionService
    try:
        response = TestClient(app).post(
            "/api/v1/images:moderate", files={"file": ("a.png", _png_bytes(), "image/png")}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.json() == {
        "safe": False,
        "categories": [{"label": "nude", "score": 0.9}],
        "scores": {"nude": 0.9, "prohibited": 0.1},
        "thresholds": {"nude": 0.5},
        "frames": [],
    }


def test_should_return_label_scores_when_predicting_upload():
    app.dependency_overrides[get_vision_service] = FakeVisionService
    try:
        response = TestClient(app).post(
            "/api/v1/images:predict", files={"file": ("a.png", _png_bytes(), "image/png")}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.json() == {
        "labels": ["cat", "dog"],
        "predictions": [{"label": "cat", "score": 0.7}, {"label": "dog", "score": 0.2}],
    }


def test_should_return_frame_timeline_when_moderating_video_upload():
    app.dependency_overrides[get_vision_service] = FakeVisionService
    try:
        response = TestClient(app).post(
            "/api/v1/videos:moderate", files={"file": ("a.mp4", b"video", "video/mp4")}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.json()["scores"] == {"nude": 0.8}
    assert response.json()["frames"] == [
        {"offset_seconds": 0.0, "scores": {"nude": 0.1}, "safe": True},
        {"offset_seconds": 1.0, "scores": {"nude": 0.8}, "safe": False},
    ]


def test_should_reject_json_body_without_image_url():
    response = TestClient(app).post("/api/v1/images:predict", json={})

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing image_url"

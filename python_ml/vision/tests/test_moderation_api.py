import io

from fastapi.testclient import TestClient
from PIL import Image

from vision.domain.moderation import ModerationCategory, verdict
from vision.service.vision import get_vision_service
from server import create_app

app = create_app(["vision"])


class FakeVisionService:
    def open_image_bytes(self, content):
        return Image.open(io.BytesIO(content))

    def moderate_image(self, image):
        return verdict([ModerationCategory("nude", 0.4), ModerationCategory("nude", 0.9)])


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

    assert response.json() == {"safe": False, "categories": [{"label": "nude", "score": 0.9}]}


def test_should_reject_json_body_without_image_url():
    response = TestClient(app).post("/api/v1/images:predict", json={})

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing image_url"

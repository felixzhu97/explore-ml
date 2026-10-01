from fastapi.testclient import TestClient

from image_playground.infra import pipeline
from image_playground.service.image import get_image_service
from server import create_app

app = create_app(["image_playground"])

client = TestClient(app)


def test_should_return_pending_job_without_empty_fields():
    job = get_image_service().create_job()

    response = client.get(f"/api/v1/imageJobs/{job.id}")

    assert response.json() == {"name": f"imageJobs/{job.id}", "status": "pending"}


def test_should_return_image_url_when_job_succeeds(monkeypatch):
    monkeypatch.setattr(pipeline, "generate", lambda prompt, negative_prompt, output_path: None)
    image_service = get_image_service()
    job = image_service.create_job()
    image_service.run_job(job.id, "a red fox", "")

    response = client.get(f"/api/v1/imageJobs/{job.id}")

    assert response.json()["status"] == "succeeded"
    assert response.json()["image_url"].endswith(f"/output/image/{job.id}.png")


def test_should_return_404_for_unknown_job():
    assert client.get("/api/v1/imageJobs/job-missing").status_code == 404

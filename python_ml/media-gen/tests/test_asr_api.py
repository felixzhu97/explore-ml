from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_should_reject_unsupported_audio_type_for_asr():
    response = client.post(
        "/api/v1/audios:transcribe",
        files={"file": ("note.txt", b"not audio", "text/plain")},
    )
    assert response.status_code == 400
    body = response.json()
    message = body.get("message") or body.get("detail") or ""
    assert "Unsupported audio type" in message

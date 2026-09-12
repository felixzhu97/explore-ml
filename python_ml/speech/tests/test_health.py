from main import app


def test_should_register_speech_routes():
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/api/v1/voices:synthesize" in paths
    assert "/api/v1/audios:transcribe" in paths
    assert "/ws/v1/audios:transcribe" in paths
    assert "/output/voice/{job_id}.wav" in paths
    assert "/output/voice/{job_id}.mp3" in paths
    assert "/api/v1/images:generate" not in paths
    assert "/api/v1/videos:generate" not in paths

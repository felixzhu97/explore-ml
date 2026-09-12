from main import app


def test_should_register_video_routes():
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/api/v1/videos:generate" in paths
    assert "/api/v1/videoJobs/{video_job}" in paths
    assert "/output/video/{job_id}.mp4" in paths
    assert "/api/v1/images:generate" not in paths
    assert "/api/v1/voices:synthesize" not in paths

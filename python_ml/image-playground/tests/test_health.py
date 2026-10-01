from controller.api import router


def test_should_register_image_playground_routes():
    paths = {getattr(r, "path", None) for r in router.routes}
    assert "/api/v1/images:generate" in paths
    assert "/api/v1/imageJobs/{image_job}" in paths
    assert "/output/image/{job_id}.png" in paths
    assert "/api/v1/voices:synthesize" not in paths
    assert "/api/v1/videos:generate" not in paths

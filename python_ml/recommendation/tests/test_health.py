from recommendation.controller.api import router


def test_health_route_registered():
    paths = {getattr(r, "path", None) for r in router.routes}
    assert "/api/v1/feeds:rank" in paths
    assert "/api/v1/explores:rank" in paths
    assert "/api/v1/reels:rank" in paths
    assert "/api/v1/feeds:recall" in paths
    assert "/v1/feed/rank" not in paths

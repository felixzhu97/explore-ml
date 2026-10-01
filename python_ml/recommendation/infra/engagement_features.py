from collections import defaultdict
from datetime import datetime, UTC

from infra.cassandra_engagement import get_cassandra_session, load_post_likes


def load_user_post_engagement(
    max_rows: int = 1000000,
) -> dict[tuple[str, str], dict[str, int]]:
    session, cluster = get_cassandra_session()
    try:
        rows = load_post_likes(session, max_rows=max_rows)
    finally:
        cluster.shutdown()
    counts: dict[tuple[str, str], dict[str, int]] = defaultdict(lambda: {"like": 0})
    for user_id, post_id, _ in rows:
        key = (user_id, post_id)
        counts[key]["like"] += 1
    return counts


def build_user_recent_engagement_features(
    now: datetime | None = None,
    max_rows: int = 1000000,
) -> dict[tuple[str, str], dict[str, float]]:
    now_datetime = now or datetime.now(UTC)
    engagement_counts = load_user_post_engagement(max_rows=max_rows)
    features: dict[tuple[str, str], dict[str, float]] = {}
    for key, counts in engagement_counts.items():
        like_count = float(counts.get("like", 0))
        features[key] = {
            "like_count": like_count,
        }
    return features


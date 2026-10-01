
import psycopg2
import json

import config


def load_reels_events(
    event_names: list[str] | None = None,
    max_rows: int = 1000000,
) -> list[tuple[str, str, float, float]]:
    names = event_names or ["reels_view", "reels_complete"]
    connection = psycopg2.connect(config.DATABASE_URL)
    cursor = connection.cursor()
    cursor.execute(
        """
        SELECT event_name, user_id, properties, created_at
        FROM analytics_events
        WHERE event_name = ANY(%s)
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (names, max_rows),
    )
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    reel_events: list[tuple[str, str, float, float]] = []
    for event_name, user_id, properties, created_at in rows:
        user = str(user_id) if user_id is not None else ""
        event_properties = properties or {}
        if isinstance(event_properties, str):
            try:
                event_properties = json.loads(event_properties)
            except Exception:
                event_properties = {}
        reel_id = str(event_properties.get("reelId") or "")
        if not user or not reel_id:
            continue
        watch_ms = float(event_properties.get("watchTimeMs") or 0.0)
        duration_ms = float(event_properties.get("durationMs") or 0.0)
        reel_events.append((user, reel_id, watch_ms, duration_ms))
    return reel_events


def build_reels_engagement_features(
    max_rows: int = 1000000,
) -> dict[tuple[str, str], dict[str, float]]:
    events = load_reels_events(max_rows=max_rows)
    aggregates: dict[tuple[str, str], dict[str, float]] = {}
    for user_id, reel_id, watch_ms, duration_ms in events:
        key = (user_id, reel_id)
        state = aggregates.get(key)
        if state is None:
            state = {
                "views": 0.0,
                "completes": 0.0,
                "total_watch_ms": 0.0,
                "total_duration_ms": 0.0,
            }
            aggregates[key] = state
        state["views"] += 1.0
        state["total_watch_ms"] += watch_ms
        state["total_duration_ms"] += duration_ms
        if duration_ms > 0.0 and watch_ms >= duration_ms * 0.9:
            state["completes"] += 1.0
    for key, state in aggregates.items():
        views = state["views"]
        completes = state["completes"]
        total_watch = state["total_watch_ms"]
        total_duration = state["total_duration_ms"]
        state["complete_rate"] = completes / views if views > 0.0 else 0.0
        state["avg_watch_ratio"] = (total_watch / total_duration) if total_duration > 0.0 else 0.0
    return aggregates


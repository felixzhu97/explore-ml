import psycopg2
from datetime import datetime
import numpy as np
from recommendation import config


def load_user_features() -> list[tuple[str, int]]:
    connection = psycopg2.connect(config.DATABASE_URL)
    cursor = connection.cursor()
    cursor.execute("SELECT id, created_at FROM users")
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    user_buckets = []
    for user_id, created_at in rows:
        if created_at and hasattr(created_at, "month"):
            bucket = created_at.month % 4
        else:
            try:
                created_at_datetime = (
                    datetime.fromisoformat(str(created_at).replace("Z", "+00:00")) if created_at else None
                )
                bucket = (created_at_datetime.month % 4) if created_at_datetime else 0
            except Exception:
                bucket = 0
        user_buckets.append((user_id, bucket))
    return user_buckets


def build_item_features_matrix(
    user_ids: list[str],
    user_buckets: dict,
    n_buckets: int = 4,
) -> np.ndarray:
    user_count = len(user_ids)
    features = np.zeros((user_count, n_buckets + 1), dtype=np.float32)
    for user_index, user_id in enumerate(user_ids):
        features[user_index, 0] = 1.0
        bucket = user_buckets.get(user_id, 0)
        if 0 <= bucket < n_buckets:
            features[user_index, 1 + bucket] = 1.0
    return features

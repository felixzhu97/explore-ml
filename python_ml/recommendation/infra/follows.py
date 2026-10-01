import psycopg2
from recommendation import config


def load_follows(limit_following_per_user: int = 0) -> list[tuple[str, str]]:
    connection = psycopg2.connect(config.DATABASE_URL)
    cursor = connection.cursor()
    cursor.execute(
        """
        SELECT follower_id, following_id
        FROM user_follows
        ORDER BY follower_id, following_id
        """
    )
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    if limit_following_per_user <= 0:
        return [(row[0], row[1]) for row in rows]
    from collections import defaultdict
    following_by_follower = defaultdict(list)
    for follower_id, following_id in rows:
        following_by_follower[follower_id].append(following_id)
    limited_follows = []
    for follower_id, following_ids in following_by_follower.items():
        for following_id in following_ids[:limit_following_per_user]:
            limited_follows.append((follower_id, following_id))
    return limited_follows


def load_user_ids() -> set:
    connection = psycopg2.connect(config.DATABASE_URL)
    cursor = connection.cursor()
    cursor.execute("SELECT id FROM users")
    user_ids = {row[0] for row in cursor.fetchall()}
    cursor.close()
    connection.close()
    return user_ids

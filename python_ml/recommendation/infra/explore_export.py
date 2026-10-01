import json
import redis
import config

EXPLORE_HOT_KEY = "explore:hot"
EXPLORE_TTL_SECONDS = 300


def get_redis_client() -> redis.Redis:
    return redis.from_url(
        config.REDIS_URL,
        password=config.REDIS_PASSWORD,
        decode_responses=True,
    )


def write_explore_hot(entries: list) -> None:
    client = get_redis_client()
    value = json.dumps(entries)
    client.set(EXPLORE_HOT_KEY, value, ex=EXPLORE_TTL_SECONDS)
    client.close()

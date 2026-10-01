import json
import redis
import config


def get_redis_client() -> redis.Redis:
    return redis.from_url(
        config.REDIS_URL,
        password=config.REDIS_PASSWORD,
        decode_responses=True,
    )


def write_user_suggestions(suggestions: dict, ttl_seconds: int = 0) -> None:
    client = get_redis_client()
    expiry_seconds = ttl_seconds or config.SUGGESTION_TTL_SECONDS
    max_per_user = config.SUGGESTION_MAX_PER_USER
    key_prefix = config.SUGGESTION_REDIS_KEY_PREFIX
    redis_pipeline = client.pipeline()
    for user_id, suggested_user_ids in suggestions.items():
        key = f"{key_prefix}{user_id}"
        value = json.dumps(suggested_user_ids[:max_per_user])
        redis_pipeline.set(key, value, ex=expiry_seconds)
    redis_pipeline.execute()
    client.close()

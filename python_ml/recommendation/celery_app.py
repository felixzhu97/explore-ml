from celery import Celery
from recommendation import config

app = Celery(
    "recommendation",
    broker=config.CELERY_BROKER_URL,
    backend=config.CELERY_BROKER_URL,
    include=["recommendation.tasks"],
)
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_retry_delay=60,
    task_max_retries=2,
    beat_schedule={
        "suggestions-every-6h": {
            "task": "recommendation.tasks.run_suggestions",
            "schedule": 21600.0,
        },
        "explore-every-5min": {
            "task": "recommendation.tasks.run_explore",
            "schedule": 300.0,
        },
    },
)

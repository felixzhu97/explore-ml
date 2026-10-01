"""Builds vector stores and the feed ranker from configuration."""

from __future__ import annotations

import os
from typing import Optional

import redis

import config as cfg
from infra.feed_ranker import FeedRankingService
from infra.vector_store import FaissVectorStore, RedisVectorStore


class VectorStoreFactory:
    @staticmethod
    def create_redis_store() -> RedisVectorStore:
        client = redis.from_url(
            cfg.REDIS_URL, password=cfg.REDIS_PASSWORD, decode_responses=True
        )
        return RedisVectorStore(
            client,
            user_key_prefix="rec:user:vec:",
            item_key_prefix="rec:post:vec:",
        )

    @staticmethod
    def create_faiss_store() -> FaissVectorStore:
        dim = int(os.getenv("FAISS_DIM", "64"))
        return FaissVectorStore(
            dim=dim,
            index_path=os.getenv("FAISS_INDEX_PATH"),
            ids_path=os.getenv("FAISS_IDS_PATH"),
        )

    @staticmethod
    def get_vector_store():
        backend = os.getenv("VECTOR_BACKEND", "redis").lower()
        if backend == "faiss":
            return VectorStoreFactory.create_faiss_store()
        return VectorStoreFactory.create_redis_store()


class RankerFactory:
    @staticmethod
    def create_ranker() -> Optional[FeedRankingService]:
        model_path = cfg.FEED_RANKER_MODEL
        if not model_path.is_file():
            return None
        return FeedRankingService(model_path=str(model_path))

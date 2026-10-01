from collections.abc import Iterable

import math
import numpy as np

from recommendation.domain.vector_store import VectorStore


class RedisVectorStore(VectorStore):
    def __init__(self, client, user_key_prefix: str = "rec:user:vec:", item_key_prefix: str = "rec:item:vec:"):
        self.client = client
        self.user_key_prefix = user_key_prefix
        self.item_key_prefix = item_key_prefix

    def upsert_user_vectors(self, vectors: dict[str, list[float]]) -> None:
        redis_pipeline = self.client.pipeline()
        for user_id, vector in vectors.items():
            key = f"{self.user_key_prefix}{user_id}"
            redis_pipeline.set(key, ",".join(str(component) for component in vector))
        redis_pipeline.execute()

    def upsert_item_vectors(self, vectors: dict[str, list[float]]) -> None:
        redis_pipeline = self.client.pipeline()
        for item_id, vector in vectors.items():
            key = f"{self.item_key_prefix}{item_id}"
            redis_pipeline.set(key, ",".join(str(component) for component in vector))
        redis_pipeline.execute()

    def query_similar_items(self, user_vector: list[float], top_k: int) -> list[tuple[str, float]]:
        keys = list(self.client.scan_iter(f"{self.item_key_prefix}*"))
        if not keys:
            return []
        scores = []
        for key in keys:
            stored_vector = self.client.get(key)
            if not stored_vector:
                continue
            parts = stored_vector.split(",")
            item_vector = [float(part) for part in parts if part]
            score = self._cosine_similarity(user_vector, item_vector)
            item_id = key.replace(self.item_key_prefix, "", 1)
            scores.append((item_id, score))
        scores.sort(key=lambda item_and_score: item_and_score[1], reverse=True)
        return scores[:top_k]

    def _cosine_similarity(self, left_vector: Iterable[float], right_vector: Iterable[float]) -> float:
        left = list(left_vector)
        right = list(right_vector)
        if not left or not right or len(left) != len(right):
            return 0.0
        dot_product = sum(left_value * right_value for left_value, right_value in zip(left, right))
        left_norm = math.sqrt(sum(value * value for value in left))
        right_norm = math.sqrt(sum(value * value for value in right))
        if left_norm == 0.0 or right_norm == 0.0:
            return 0.0
        return dot_product / (left_norm * right_norm)


class FaissVectorStore(VectorStore):
    def __init__(self, dimension: int, index_path: str | None = None, ids_path: str | None = None):
        import faiss

        self.faiss = faiss
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension)
        self.item_ids: list[str] = []
        if index_path and ids_path:
            self.index = faiss.read_index(index_path)
            with open(ids_path, encoding="utf-8") as ids_file:
                self.item_ids = [line.strip() for line in ids_file if line.strip()]

    def upsert_user_vectors(self, vectors: dict[str, list[float]]) -> None:
        return

    def upsert_item_vectors(self, vectors: dict[str, list[float]]) -> None:
        item_ids = []
        item_vectors = []
        for item_id, vector in vectors.items():
            if len(vector) != self.dimension:
                continue
            item_ids.append(item_id)
            item_vectors.append(vector)
        if not item_vectors:
            return
        vector_matrix = np.array(item_vectors, dtype="float32")
        self.index.add(vector_matrix)
        self.item_ids.extend(item_ids)

    def query_similar_items(self, user_vector: list[float], top_k: int) -> list[tuple[str, float]]:
        if not self.item_ids or self.index.ntotal == 0:
            return []
        if len(user_vector) != self.dimension:
            return []
        query_matrix = np.array([user_vector], dtype="float32")
        scores, indices = self.index.search(query_matrix, top_k)
        similar_items: list[tuple[str, float]] = []
        for item_index, score in zip(indices[0], scores[0]):
            if item_index < 0 or item_index >= len(self.item_ids):
                continue
            similar_items.append((self.item_ids[item_index], float(score)))
        return similar_items

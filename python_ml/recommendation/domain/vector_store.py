from abc import ABC, abstractmethod


class VectorStore(ABC):
    @abstractmethod
    def upsert_user_vectors(self, vectors: dict[str, list[float]]) -> None:
        raise NotImplementedError

    @abstractmethod
    def upsert_item_vectors(self, vectors: dict[str, list[float]]) -> None:
        raise NotImplementedError

    @abstractmethod
    def query_similar_items(self, user_vector: list[float], top_k: int) -> list[tuple[str, float]]:
        raise NotImplementedError

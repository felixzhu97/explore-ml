from abc import ABC, abstractmethod
from typing import Dict, List, Tuple


class VectorStore(ABC):
    @abstractmethod
    def upsert_user_vectors(self, vectors: Dict[str, List[float]]) -> None:
        raise NotImplementedError

    @abstractmethod
    def upsert_item_vectors(self, vectors: Dict[str, List[float]]) -> None:
        raise NotImplementedError

    @abstractmethod
    def query_similar_items(self, user_vector: List[float], top_k: int) -> List[Tuple[str, float]]:
        raise NotImplementedError

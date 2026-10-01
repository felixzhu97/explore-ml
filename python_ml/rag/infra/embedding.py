"""Embedding service for generating text embeddings."""
import logging

import ollama
from openai import AsyncOpenAI

from rag import config

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text embeddings using Ollama or OpenAI."""

    def __init__(self) -> None:
        self._provider = config.EMBEDDING_PROVIDER
        self._model = config.EMBEDDING_MODEL
        self._openai_model = config.OPENAI_EMBEDDING_MODEL

        if self._provider == "openai":
            self._openai_client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
        else:
            self._ollama_client = ollama.AsyncClient(host=config.OLLAMA_BASE_URL)

        logger.info(
            f"EmbeddingService initialized with provider: {self._provider}"
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of text strings to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        if self._provider == "ollama":
            return await self._embed_ollama(texts)
        else:
            return await self._embed_openai(texts)

    async def embed_single(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text string to embed

        Returns:
            Embedding vector
        """
        embeddings = await self.embed([text])
        return embeddings[0] if embeddings else []

    async def _embed_ollama(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using Ollama."""
        embeddings = []
        for text in texts:
            try:
                response = await self._ollama_client.embeddings(
                    model=self._model,
                    prompt=text,
                )
                embeddings.append(response["embedding"])
            except Exception as error:
                logger.error(f"Ollama embedding failed for text: {error}")
                raise

        return embeddings

    async def _embed_openai(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using OpenAI."""
        try:
            response = await self._openai_client.embeddings.create(
                model=self._openai_model,
                input=texts,
            )
            return [item.embedding for item in response.data]
        except Exception as error:
            logger.error(f"OpenAI embedding failed: {error}")
            raise

    async def health_check(self) -> bool:
        """Check if the embedding service is healthy."""
        try:
            test_embedding = await self.embed_single("health check")
            return len(test_embedding) > 0
        except Exception as error:
            logger.error(f"Embedding service health check failed: {error}")
            return False


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service

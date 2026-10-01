"""Chat completion client for Ollama or OpenAI."""

import logging
from collections.abc import AsyncIterator
from functools import lru_cache

import ollama
from openai import AsyncOpenAI

from rag.config import get_settings
from rag.domain.errors import ServiceUnavailableError

logger = logging.getLogger(__name__)

UNAVAILABLE_MESSAGE = "LLM service unavailable"
OPENAI_TEMPERATURE = 0.7


class LlmClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._provider = settings.llm_provider
        self._timeout = settings.llm_timeout
        if self._provider == "ollama":
            self._model = settings.llm_model
            self._ollama = ollama.AsyncClient(host=settings.ollama_base_url)
        else:
            self._model = settings.openai_llm_model
            self._openai = AsyncOpenAI(api_key=settings.openai_api_key)

    async def complete(self, system_prompt: str, question: str) -> str:
        messages = _messages(system_prompt, question)
        try:
            if self._provider == "ollama":
                response = await self._ollama.chat(
                    model=self._model, messages=messages, options=self._ollama_options()
                )
                return response["message"]["content"]
            completion = await self._openai.chat.completions.create(
                model=self._model, messages=messages, temperature=OPENAI_TEMPERATURE
            )
            return completion.choices[0].message.content or ""
        except Exception as error:
            logger.error("%s chat failed: %s", self._provider, error)
            raise ServiceUnavailableError(UNAVAILABLE_MESSAGE) from error

    async def stream(self, system_prompt: str, question: str) -> AsyncIterator[str]:
        messages = _messages(system_prompt, question)
        try:
            if self._provider == "ollama":
                ollama_stream = await self._ollama.chat(
                    model=self._model,
                    messages=messages,
                    stream=True,
                    options=self._ollama_options(),
                )
                async for part in ollama_stream:
                    content = (part.get("message") or {}).get("content")
                    if content:
                        yield content
            else:
                openai_stream = await self._openai.chat.completions.create(
                    model=self._model,
                    messages=messages,
                    temperature=OPENAI_TEMPERATURE,
                    stream=True,
                )
                async for part in openai_stream:
                    if part.choices and part.choices[0].delta.content:
                        yield part.choices[0].delta.content
        except Exception as error:
            logger.error("%s streaming failed: %s", self._provider, error)
            yield f"Error: {UNAVAILABLE_MESSAGE}"

    def _ollama_options(self) -> dict | None:
        return {"timeout": self._timeout} if self._timeout else None


def _messages(system_prompt: str, question: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]


@lru_cache
def get_llm_client() -> LlmClient:
    return LlmClient()

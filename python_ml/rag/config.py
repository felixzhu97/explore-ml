import os
from pathlib import Path

UPLOADS_DIR = Path(__file__).parent / "uploads"

QDRANT_URL = ""
QDRANT_PATH = Path(__file__).parent / "data" / "qdrant"
QDRANT_TIMEOUT = 30
QDRANT_VECTOR_SIZE = 768

EMBEDDING_PROVIDER = "ollama"
EMBEDDING_MODEL = "nomic-embed-text"
OLLAMA_BASE_URL = "http://localhost:11434"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"

LLM_PROVIDER = "ollama"
LLM_MODEL = "qwen3-coder:30b"
OPENAI_LLM_MODEL = "gpt-4-turbo-preview"
LLM_TIMEOUT = 120

CHUNK_SIZE = 256
CHUNK_OVERLAP = 50

CRAWLER_TIMEOUT = 30

CONTENT_API_URL = "http://localhost:3000"

RERANK_ENABLED = True
RERANK_URL = "http://127.0.0.1:8091"
RERANK_TIMEOUT = 30.0

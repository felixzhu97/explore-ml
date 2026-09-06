# data

Test and fixture data for Explore ML services.

- Commit small text/json fixtures and `.gitkeep` only.
- Large binaries (weights, videos, embeddings dumps) stay gitignored.
- Prefer referencing paths from service config relative to the repo root
  (`data/...`) rather than per-service `output/` or nested `rag/data`.

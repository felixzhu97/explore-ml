# data

Test and fixture data for Explore ML services.

- Commit small text/json fixtures and `.gitkeep` only.
- Large binaries (weights, videos, embeddings dumps) stay gitignored.
- Prefer referencing paths from service config relative to the repo root
  (`data/...`) rather than per-service `output/` or nested `rag/data`.

## Fine-tuning

Keep one folder per area under `finetune/`:

```text
data/finetune/
├── recommendation/eval.jsonl
├── vision/{train,eval}/<label>/
├── rag/{pairs,eval,qa}.jsonl
└── speech/eval.jsonl
```

Only `*.jsonl` fixtures are tracked. Images, audio, and full datasets stay
local or in a private Hub dataset. See the
[fine-tuning guide](../docs/user-guide/fine-tuning.md).

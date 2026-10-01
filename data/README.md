# data

Test and fixture data for Explore ML services.

- Commit small text/json fixtures and `.gitkeep` only.
- Large binaries (weights, videos, embeddings dumps) stay gitignored.
- Pass fixture paths to `training/` scripts relative to the repo root
  (`data/finetune/...`).
- Runtime state is not fixture data: RAG's embedded Qdrant store defaults to
  `python_ml/rag/data/qdrant` (`QDRANT_PATH`), and modules write generated
  files under their own `output/`. Do not commit either.

## Fine-tuning

Keep one folder per area under `finetune/`:

```text
data/finetune/
├── recommendation/eval.jsonl
├── vision/{train,eval}/<label>/   (local only, not tracked)
├── rag/{pairs,eval,qa}.jsonl
└── speech/eval.jsonl
```

Only `*.jsonl` fixtures are tracked, so the vision image folders exist only on
the machine that trains. Images, audio, and full datasets stay
local or in a private Hub dataset. See the
[fine-tuning guide](../docs/user-guide/fine-tuning.md).

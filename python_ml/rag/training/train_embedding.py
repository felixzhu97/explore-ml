"""Fine-tune the embedding model on (query, positive) pairs.

Each line of the training file is JSON: {"query": "...", "positive": "..."}.
Other pairs in the batch act as negatives (MultipleNegativesRankingLoss).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence

QUERY_PREFIX = "search_query: "
DOCUMENT_PREFIX = "search_document: "


def load_pairs(path: Path) -> List[Dict[str, str]]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        rows.append({
            "anchor": QUERY_PREFIX + row["query"],
            "positive": DOCUMENT_PREFIX + row["positive"],
        })
    return rows


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--train", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="nomic-ai/nomic-embed-text-v1.5")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    args = parser.parse_args(argv)

    from datasets import Dataset
    from sentence_transformers import (
        SentenceTransformer,
        SentenceTransformerTrainer,
        SentenceTransformerTrainingArguments,
    )
    from sentence_transformers.losses import MultipleNegativesRankingLoss
    from sentence_transformers.training_args import BatchSamplers

    model = SentenceTransformer(args.base_model, trust_remote_code=True)
    dataset = Dataset.from_list(load_pairs(Path(args.train)))
    training_args = SentenceTransformerTrainingArguments(
        output_dir=str(Path(args.output) / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        warmup_ratio=0.1,
        batch_sampler=BatchSamplers.NO_DUPLICATES,
        save_strategy="no",
        logging_steps=10,
    )
    trainer = SentenceTransformerTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        loss=MultipleNegativesRankingLoss(model),
    )
    trainer.train()
    model.save(args.output)
    print(f"Saved {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "torch",
#   "transformers>=4.51.0",
#   "peft>=0.17.0",
#   "datasets",
#   "accelerate",
#   "huggingface_hub",
# ]
# ///
"""Fine-tune a Qwen3-Reranker with LoRA as a yes/no relevance scorer.

The Hub dataset needs `query`, `document`, and `label` (1 relevant, 0 not)
columns. The merged model keeps the Qwen3-Reranker prompt, so the existing
rerank sidecar serves it unchanged.

    hf jobs uv run --flavor l40sx1 --secrets HF_TOKEN training/train_reranker.py \
      --dataset <you>/rag-rerank --push-to <you>/qwen3-reranker-ft
"""

from __future__ import annotations

import argparse
from typing import Optional, Sequence

DEFAULT_INSTRUCTION = (
    "Given a web search query, retrieve relevant passages that answer the query"
)
PREFIX = (
    "<|im_start|>system\nJudge whether the Document meets the requirements based on "
    'the Query and the Instruct provided. Note that the answer can only be "yes" or '
    '"no".<|im_end|>\n<|im_start|>user\n'
)
SUFFIX = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"


def format_pair(query: str, document: str, instruction: str = DEFAULT_INSTRUCTION) -> str:
    return f"{PREFIX}<Instruct>: {instruction}\n<Query>: {query}\n<Document>: {document}{SUFFIX}"


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LoRA fine-tune for Qwen3-Reranker")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen3-Reranker-0.6B")
    parser.add_argument("--push-to", help="Private Hub repo for the merged model")
    parser.add_argument("--output-dir", default="qwen3-reranker-ft")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--max-length", type=int, default=1024)
    parser.add_argument("--rank", type=int, default=16)
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    import torch
    from datasets import load_dataset
    from peft import LoraConfig, get_peft_model
    from torch.utils.data import DataLoader
    from transformers import AutoModelForCausalLM, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, padding_side="left")
    model = AutoModelForCausalLM.from_pretrained(args.base_model, torch_dtype=torch.bfloat16)
    model = get_peft_model(
        model,
        LoraConfig(
            r=args.rank,
            lora_alpha=args.rank * 2,
            lora_dropout=0.05,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
            task_type="CAUSAL_LM",
        ),
    ).to(device)
    yes_id = tokenizer.convert_tokens_to_ids("yes")
    no_id = tokenizer.convert_tokens_to_ids("no")

    rows = load_dataset(args.dataset, split="train")

    def collate(batch):
        texts = [format_pair(r["query"], r["document"]) for r in batch]
        enc = tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=args.max_length,
            return_tensors="pt",
        )
        enc["labels"] = torch.tensor([int(r["label"]) for r in batch])
        return enc

    loader = DataLoader(rows, batch_size=args.batch_size, shuffle=True, collate_fn=collate)
    optimizer = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad], lr=args.learning_rate
    )
    model.train()
    for epoch in range(args.epochs):
        for step, batch in enumerate(loader):
            labels = batch.pop("labels").to(device)
            batch = {k: v.to(device) for k, v in batch.items()}
            logits = model(**batch).logits[:, -1, :]
            pair = torch.stack([logits[:, no_id], logits[:, yes_id]], dim=1).float()
            loss = torch.nn.functional.cross_entropy(pair, labels)
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
            if step % 20 == 0:
                print(f"epoch {epoch + 1} step {step} loss={loss.item():.4f}")

    merged = model.merge_and_unload()
    merged.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    if args.push_to:
        merged.push_to_hub(args.push_to, private=True)
        tokenizer.push_to_hub(args.push_to, private=True)
    print(f"Saved {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

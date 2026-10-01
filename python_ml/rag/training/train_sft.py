# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "torch",
#   "transformers>=4.51.0",
#   "trl>=0.20.0",
#   "peft>=0.17.0",
#   "bitsandbytes",
#   "datasets",
#   "accelerate",
#   "huggingface_hub",
# ]
# ///
"""QLoRA SFT for the RAG chat model, merged for GGUF / Ollama export.

The Hub dataset needs a `messages` column in chat format
([{"role": "user", "content": ...}, {"role": "assistant", "content": ...}]).

    hf jobs uv run --flavor l40sx1 --timeout 6h --secrets HF_TOKEN \
      training/train_sft.py --dataset <you>/rag-sft --push-to <you>/rag-llm-ft
"""

from __future__ import annotations

import argparse
from typing import Optional, Sequence


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QLoRA SFT for the RAG LLM")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen3-8B")
    parser.add_argument("--push-to", help="Private Hub repo for the merged model")
    parser.add_argument("--output-dir", default="rag-llm-ft")
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--rank", type=int, default=16)
    parser.add_argument("--max-length", type=int, default=2048)
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    import torch
    from datasets import load_dataset
    from peft import LoraConfig, PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    quantized = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        ),
        device_map="auto",
    )
    trainer = SFTTrainer(
        model=quantized,
        processing_class=tokenizer,
        train_dataset=load_dataset(args.dataset, split="train"),
        peft_config=LoraConfig(
            r=args.rank,
            lora_alpha=args.rank * 2,
            lora_dropout=0.05,
            target_modules="all-linear",
            task_type="CAUSAL_LM",
        ),
        args=SFTConfig(
            output_dir=f"{args.output_dir}-adapter",
            num_train_epochs=args.epochs,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=8,
            gradient_checkpointing=True,
            learning_rate=args.learning_rate,
            lr_scheduler_type="cosine",
            warmup_ratio=0.03,
            max_length=args.max_length,
            bf16=True,
            logging_steps=10,
            save_strategy="no",
            report_to="none",
        ),
    )
    trainer.train()
    trainer.save_model(f"{args.output_dir}-adapter")

    del trainer, quantized
    torch.cuda.empty_cache()
    base = AutoModelForCausalLM.from_pretrained(
        args.base_model, torch_dtype=torch.bfloat16, device_map="auto"
    )
    merged = PeftModel.from_pretrained(base, f"{args.output_dir}-adapter").merge_and_unload()
    merged.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    if args.push_to:
        merged.push_to_hub(args.push_to, private=True)
        tokenizer.push_to_hub(args.push_to, private=True)
    print(f"Saved {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

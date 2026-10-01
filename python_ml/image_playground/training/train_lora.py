# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "diffusers @ git+https://github.com/huggingface/diffusers",
#   "peft>=0.17.0",
#   "accelerate>=1.15.0",
#   "transformers>=4.57.0",
#   "datasets",
#   "bitsandbytes",
#   "huggingface_hub",
#   "sentencepiece",
#   "torch",
#   "torchvision",
# ]
# ///
"""Train a Qwen-Image LoRA with the diffusers DreamBooth example.

Run on one GPU with Hugging Face Jobs:

    hf jobs uv run --flavor a100-large --timeout 6h --secrets HF_TOKEN \
      training/train_lora.py --dataset <you>/my-style \
      --instance-prompt "a photo in my-style" --push-to <you>/qwen-image-my-style
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import List, Optional, Sequence

SCRIPT_URL = (
    "https://raw.githubusercontent.com/huggingface/diffusers/main/"
    "examples/dreambooth/train_dreambooth_lora_qwen_image.py"
)


def build_command(args: argparse.Namespace, script: Path) -> List[str]:
    command = [
        sys.executable, "-m", "accelerate.commands.launch", str(script),
        "--pretrained_model_name_or_path", args.base_model,
        "--dataset_name", args.dataset,
        "--instance_prompt", args.instance_prompt,
        "--output_dir", args.output_dir,
        "--mixed_precision", "bf16",
        "--resolution", str(args.resolution),
        "--train_batch_size", "1",
        "--gradient_accumulation_steps", "4",
        "--rank", str(args.rank),
        "--learning_rate", str(args.learning_rate),
        "--lr_scheduler", "constant",
        "--lr_warmup_steps", "0",
        "--max_train_steps", str(args.max_train_steps),
        "--use_8bit_adam",
        "--cache_latents",
        "--gradient_checkpointing",
        "--seed", "0",
    ]
    if args.caption_column:
        command += ["--caption_column", args.caption_column]
    if args.push_to:
        command += ["--push_to_hub", "--hub_model_id", args.push_to]
    return command


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a Qwen-Image LoRA")
    parser.add_argument("--dataset", required=True, help="Hub dataset with an image column")
    parser.add_argument("--instance-prompt", required=True)
    parser.add_argument("--caption-column", help="Per-image caption column, if any")
    parser.add_argument("--base-model", default="Qwen/Qwen-Image")
    parser.add_argument("--output-dir", default="qwen-image-lora")
    parser.add_argument("--push-to", help="Private Hub repo for the LoRA")
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--rank", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--max-train-steps", type=int, default=1000)
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    script = Path("train_dreambooth_lora_qwen_image.py")
    urllib.request.urlretrieve(SCRIPT_URL, script)
    return subprocess.call(build_command(args, script))


if __name__ == "__main__":
    raise SystemExit(main())

# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "qwen-asr",
#   "datasets",
#   "huggingface_hub",
# ]
# ///
"""Fine-tune Qwen3-ASR with the upstream recipe on one GPU.

The Hub dataset holds WAV files plus `train.jsonl` rows of
{"audio": "relative/path.wav", "text": "transcript"}.

    hf jobs uv run --flavor l40sx1 --timeout 6h --secrets HF_TOKEN \
      training/train_asr.py --dataset <you>/asr-domain --push-to <you>/qwen3-asr-ft
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import Iterable, Optional, Sequence

REPO_ZIP = "https://github.com/QwenLM/Qwen3-ASR/archive/refs/heads/main.zip"


def absolutize_manifest(source: Path, target: Path, keys: Iterable[str]) -> int:
    rows = 0
    with source.open(encoding="utf-8") as src, target.open("w", encoding="utf-8") as dst:
        for line in src:
            if not line.strip():
                continue
            row = json.loads(line)
            for key in keys:
                row[key] = str((source.parent / row[key]).resolve())
            dst.write(json.dumps(row, ensure_ascii=False) + "\n")
            rows += 1
    return rows


def latest_checkpoint(output_dir: Path) -> Path:
    checkpoints = [p for p in output_dir.glob("checkpoint-*") if p.is_dir()]
    if not checkpoints:
        raise SystemExit(f"No checkpoint under {output_dir}")
    return max(checkpoints, key=lambda p: int(re.findall(r"\d+", p.name)[-1]))


def fetch_recipe(dest: Path) -> Path:
    with urllib.request.urlopen(REPO_ZIP) as response:
        zipfile.ZipFile(io.BytesIO(response.read())).extractall(dest)
    return next(dest.glob("*/finetuning"))


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Fine-tune Qwen3-ASR")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--base-model", default="Qwen/Qwen3-ASR-1.7B")
    parser.add_argument("--push-to")
    parser.add_argument("--output-dir", default="qwen3-asr-ft")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args(argv)

    from huggingface_hub import HfApi, snapshot_download

    data = Path(snapshot_download(args.dataset, repo_type="dataset", local_dir="asr-data"))
    train = Path("train.abs.jsonl").resolve()
    print(f"{absolutize_manifest(data / 'train.jsonl', train, ['audio'])} training rows")
    recipe = fetch_recipe(Path("recipe"))
    output = Path(args.output_dir).resolve()
    code = subprocess.call(
        [
            sys.executable, "qwen3_asr_sft.py",
            "--model_path", args.base_model,
            "--train_file", str(train),
            "--output_dir", str(output),
            "--batch_size", str(args.batch_size),
            "--grad_acc", "4",
            "--lr", str(args.learning_rate),
            "--epochs", str(args.epochs),
            "--save_steps", "200",
            "--save_total_limit", "2",
        ],
        cwd=recipe,
    )
    if code:
        return code
    checkpoint = latest_checkpoint(output)
    if args.push_to:
        api = HfApi()
        api.create_repo(args.push_to, private=True, exist_ok=True)
        api.upload_folder(repo_id=args.push_to, folder_path=str(checkpoint))
    print(f"Final checkpoint {checkpoint}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "qwen-tts",
#   "datasets",
#   "huggingface_hub",
# ]
# ///
"""Single-speaker SFT for Qwen3-TTS with the upstream recipe on one GPU.

The Hub dataset holds WAV files plus `train.jsonl` rows of
{"audio": "clip.wav", "text": "transcript", "ref_audio": "ref.wav"}.
Use the same reference clip on every row.

    hf jobs uv run --flavor l40sx1 --timeout 6h --secrets HF_TOKEN \
      training/train_tts.py --dataset <you>/tts-voice --speaker my_voice \
      --push-to <you>/qwen3-tts-ft
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

REPO_ZIP = "https://github.com/QwenLM/Qwen3-TTS/archive/refs/heads/main.zip"


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
    parser = argparse.ArgumentParser(description="Single-speaker SFT for Qwen3-TTS")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--speaker", required=True, help="Speaker name used as TTS_SPEAKER")
    parser.add_argument("--base-model", default="Qwen/Qwen3-TTS-12Hz-1.7B-Base")
    parser.add_argument("--tokenizer", default="Qwen/Qwen3-TTS-Tokenizer-12Hz")
    parser.add_argument("--push-to")
    parser.add_argument("--output-dir", default="qwen3-tts-ft")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--batch-size", type=int, default=2)
    args = parser.parse_args(argv)

    from huggingface_hub import HfApi, snapshot_download

    data = Path(snapshot_download(args.dataset, repo_type="dataset", local_dir="tts-data"))
    raw = Path("train_raw.jsonl").resolve()
    print(f"{absolutize_manifest(data / 'train.jsonl', raw, ['audio', 'ref_audio'])} rows")
    recipe = fetch_recipe(Path("recipe"))
    codes = Path("train_with_codes.jsonl").resolve()
    output = Path(args.output_dir).resolve()
    steps = [
        [
            sys.executable, "prepare_data.py",
            "--device", "cuda:0",
            "--tokenizer_model_path", args.tokenizer,
            "--input_jsonl", str(raw),
            "--output_jsonl", str(codes),
        ],
        [
            sys.executable, "sft_12hz.py",
            "--init_model_path", args.base_model,
            "--output_model_path", str(output),
            "--train_jsonl", str(codes),
            "--batch_size", str(args.batch_size),
            "--lr", str(args.learning_rate),
            "--num_epochs", str(args.epochs),
            "--speaker_name", args.speaker,
        ],
    ]
    for step in steps:
        code = subprocess.call(step, cwd=recipe)
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

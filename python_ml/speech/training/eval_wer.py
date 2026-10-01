"""Compare ASR checkpoints by word error rate (character error rate for CJK).

Each manifest line is JSON: {"audio": "clip.wav", "text": "reference"}, with
audio paths relative to the manifest file.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Sequence

_CJK = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]")
_PUNCT = re.compile(r"[^\w\s]")


def tokenize(text: str) -> List[str]:
    cleaned = _PUNCT.sub(" ", text.lower())
    if _CJK.search(cleaned):
        return [c for c in cleaned if not c.isspace()]
    return cleaned.split()


def edit_distance(ref: Sequence[str], hyp: Sequence[str]) -> int:
    row = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, start=1):
        prev, row[0] = row[0], i
        for j, h in enumerate(hyp, start=1):
            prev, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, prev + (r != h))
    return row[-1]


def error_rate(pairs: List[Dict[str, str]]) -> float:
    errors = total = 0
    for pair in pairs:
        ref, hyp = tokenize(pair["ref"]), tokenize(pair["hyp"])
        errors += edit_distance(ref, hyp)
        total += len(ref)
    return errors / max(1, total)


def transcribe_all(model_path: str, manifest: Path) -> List[Dict[str, str]]:
    import torch
    from qwen_asr import Qwen3ASRModel

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = Qwen3ASRModel.from_pretrained(
        model_path,
        dtype=torch.bfloat16 if device == "cuda" else torch.float32,
        device_map=device,
        max_inference_batch_size=1,
        max_new_tokens=512,
    )
    pairs = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        result = model.transcribe(audio=str(manifest.parent / row["audio"]))
        first = result[0] if result else None
        text = getattr(first, "text", None)
        if text is None and isinstance(first, dict):
            text = first.get("text")
        pairs.append({"ref": row["text"], "hyp": text or ""})
    return pairs


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--baseline")
    args = parser.parse_args(argv)
    manifest = Path(args.manifest)
    result = {"model": error_rate(transcribe_all(args.model, manifest))}
    if args.baseline:
        result["baseline"] = error_rate(transcribe_all(args.baseline, manifest))
    print(json.dumps({"error_rate": result}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

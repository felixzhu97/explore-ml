"""Report top-1 accuracy and a confusion matrix for a fine-tuned head."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import torch
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder

from vision.training.head import EVAL_TRANSFORM, load_checkpoint, pick_device


def evaluate(model_dir: Path, data_dir: Path, batch_size: int = 32) -> Dict[str, object]:
    model, labels = load_checkpoint(model_dir)
    dataset = ImageFolder(str(data_dir), transform=EVAL_TRANSFORM)
    if dataset.classes != labels:
        raise SystemExit(f"Eval labels {dataset.classes} do not match model labels {labels}")
    device = pick_device()
    model.to(device).eval()
    confusion: List[List[int]] = [[0] * len(labels) for _ in labels]
    correct = 0
    with torch.no_grad():
        for images, targets in DataLoader(dataset, batch_size=batch_size):
            preds = model(images.to(device)).argmax(dim=1).cpu()
            for t, p in zip(targets.tolist(), preds.tolist()):
                confusion[t][p] += 1
                correct += int(t == p)
    return {
        "top1": correct / max(1, len(dataset)),
        "labels": labels,
        "confusion": confusion,
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Folder with model.pt and labels.json")
    parser.add_argument("--data", required=True, help="Folder with <label>/ images")
    args = parser.parse_args(argv)
    print(json.dumps(evaluate(Path(args.model), Path(args.data)), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Fine-tune a ResNet50 head on an ImageFolder dataset (train/<label>/*.jpg)."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional, Sequence

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder

from training.head import (
    TRAIN_TRANSFORM,
    build_model,
    freeze_backbone,
    pick_device,
    save_checkpoint,
)


def train(
    data_dir: Path,
    output_dir: Path,
    epochs: int = 5,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    unfreeze_layer4: bool = False,
    pretrained: bool = True,
) -> Path:
    dataset = ImageFolder(str(data_dir / "train"), transform=TRAIN_TRANSFORM)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    device = pick_device()
    model = build_model(len(dataset.classes), pretrained=pretrained)
    freeze_backbone(model, unfreeze_layer4=unfreeze_layer4)
    model.to(device)
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(params, lr=learning_rate)
    criterion = nn.CrossEntropyLoss()
    for epoch in range(epochs):
        model.train()
        total_loss, total = 0.0, 0
        for images, targets in loader:
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad()
            loss = criterion(model(images), targets)
            loss.backward()
            optimizer.step()
            total_loss += float(loss.item()) * targets.size(0)
            total += targets.size(0)
        print(f"Epoch {epoch + 1}/{epochs} loss={total_loss / max(1, total):.4f}")
    model_path, _ = save_checkpoint(model.cpu(), dataset.classes, output_dir)
    print(f"Saved {model_path}")
    return model_path


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="Folder with train/<label>/ images")
    parser.add_argument("--output", required=True)
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--unfreeze-layer4", action="store_true")
    args = parser.parse_args(argv)
    train(
        Path(args.data),
        Path(args.output),
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        unfreeze_layer4=args.unfreeze_layer4,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

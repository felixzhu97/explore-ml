"""Shared pieces for training and evaluating a ResNet50 classification head."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Tuple

import torch
import torchvision.transforms as T
from torch import nn
from torchvision.models import ResNet50_Weights, resnet50

NORMALIZE = T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

TRAIN_TRANSFORM = T.Compose([
    T.RandomResizedCrop(224),
    T.RandomHorizontalFlip(),
    T.ToTensor(),
    NORMALIZE,
])

EVAL_TRANSFORM = T.Compose([
    T.Resize((256, 256)),
    T.CenterCrop(224),
    T.ToTensor(),
    NORMALIZE,
])


def pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def build_model(num_classes: int, pretrained: bool = True) -> nn.Module:
    weights = ResNet50_Weights.IMAGENET1K_V2 if pretrained else None
    model = resnet50(weights=weights)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def freeze_backbone(model: nn.Module, unfreeze_layer4: bool = False) -> None:
    for name, param in model.named_parameters():
        trainable = name.startswith("fc.") or (unfreeze_layer4 and name.startswith("layer4."))
        param.requires_grad = trainable


def save_checkpoint(model: nn.Module, labels: List[str], output_dir: Path) -> Tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "model.pt"
    labels_path = output_dir / "labels.json"
    torch.save({"state_dict": model.state_dict(), "num_classes": len(labels)}, model_path)
    labels_path.write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8")
    return model_path, labels_path


def load_checkpoint(model_dir: Path) -> Tuple[nn.Module, List[str]]:
    checkpoint = torch.load(model_dir / "model.pt", map_location="cpu")
    labels = json.loads((model_dir / "labels.json").read_text(encoding="utf-8"))
    model = build_model(int(checkpoint["num_classes"]), pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    return model, labels

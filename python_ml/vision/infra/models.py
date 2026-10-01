import io
import json
import logging
import os
import tempfile
from typing import Optional

import config
import torch
import torchvision.transforms as T
from PIL import Image, UnidentifiedImageError
from torchvision.models import ResNet50_Weights, resnet50

log = logging.getLogger("vision")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None
LABELS: list[str] = []
NSFW_DETECTOR = None

transform = T.Compose([
    T.Resize((256, 256)),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def load_labels():
    global LABELS
    if config.LABELS_PATH.exists():
        with open(config.LABELS_PATH, "r", encoding="utf-8") as f:
            LABELS = json.load(f)
    else:
        LABELS = [f"class_{i}" for i in range(1000)]


def load_model():
    global MODEL
    if config.MODEL_PATH:
        checkpoint = torch.load(config.MODEL_PATH, map_location="cpu")
        MODEL = resnet50(weights=None)
        MODEL.fc = torch.nn.Linear(MODEL.fc.in_features, int(checkpoint["num_classes"]))
        MODEL.load_state_dict(checkpoint["state_dict"])
        log.info("Loaded fine-tuned classifier from %s", config.MODEL_PATH)
    else:
        MODEL = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
    MODEL.eval()
    MODEL.to(DEVICE)


def load_nsfw_detector():
    global NSFW_DETECTOR
    if not config.NSFW_ENABLED:
        log.info("NSFW detection disabled by config")
        return
    try:
        from nudenet import NudeDetector

        NSFW_DETECTOR = NudeDetector()
        log.info("NSFW detector loaded (nudenet)")
    except Exception as e:
        log.warning("NSFW detector failed to load: %s", e)
        NSFW_DETECTOR = None


def open_image_bytes(content: bytes) -> Optional[Image.Image]:
    try:
        img = Image.open(io.BytesIO(content))
        return img.convert("RGB")
    except (UnidentifiedImageError, OSError):
        return None


def _to_tensor(image: Image.Image) -> torch.Tensor:
    if image.mode != "RGB":
        image = image.convert("RGB")
    w, h = image.size
    if max(w, h) > config.MAX_IMAGE_SIZE:
        ratio = config.MAX_IMAGE_SIZE / max(w, h)
        image = image.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
    return transform(image).unsqueeze(0).to(DEVICE)


def class_probs(image: Image.Image) -> torch.Tensor:
    with torch.no_grad():
        out = MODEL(_to_tensor(image))
    return torch.softmax(out[0], dim=0)


def top_labels(image: Image.Image, k: int) -> list[str]:
    probs = class_probs(image)
    _, top_indices = torch.topk(probs, min(k, len(LABELS)))
    result = []
    seen = set()
    for idx in top_indices.cpu().tolist():
        label = LABELS[idx].strip().lower().replace(" ", "_") if idx < len(LABELS) else f"class_{idx}"
        if label not in seen:
            seen.add(label)
            result.append(label)
    return result[:k]


def class_scores(image: Image.Image, indices: list[int]) -> list[float]:
    probs = class_probs(image)
    return [float(probs[i].cpu().item()) for i in indices if i < len(probs)]


def nsfw_detections(image: Image.Image) -> list[tuple[str, float]]:
    if NSFW_DETECTOR is None:
        return []
    fd, path = None, None
    try:
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=90)
        fd, path = tempfile.mkstemp(suffix=".jpg")
        os.write(fd, buf.getvalue())
        os.close(fd)
        fd = None
        detections = NSFW_DETECTOR.detect(path) or []
        result = []
        for d in detections:
            cls_name = (d.get("class") or d.get("label") or "").strip()
            if cls_name:
                result.append((cls_name, float(d.get("score") or 0)))
        return result
    except Exception as e:
        log.warning("NSFW detect error: %s", e)
        return []
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except Exception:
                pass
        if path and os.path.exists(path):
            try:
                os.unlink(path)
            except Exception:
                pass

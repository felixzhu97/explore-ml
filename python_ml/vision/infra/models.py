import io
import json
import logging
import os
import tempfile

import config
import torch
from torchvision import transforms
from PIL import Image, UnidentifiedImageError
from torchvision.models import ResNet50_Weights, resnet50

logger = logging.getLogger("vision")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None
LABELS: list[str] = []
NSFW_DETECTOR = None

preprocess = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def load_labels():
    global LABELS
    if config.LABELS_PATH.exists():
        with open(config.LABELS_PATH, encoding="utf-8") as f:
            LABELS = json.load(f)
    else:
        LABELS = [f"class_{index}" for index in range(1000)]


def load_model():
    global MODEL
    if config.MODEL_PATH:
        checkpoint = torch.load(config.MODEL_PATH, map_location="cpu")
        MODEL = resnet50(weights=None)
        MODEL.fc = torch.nn.Linear(MODEL.fc.in_features, int(checkpoint["num_classes"]))
        MODEL.load_state_dict(checkpoint["state_dict"])
        logger.info("Loaded fine-tuned classifier from %s", config.MODEL_PATH)
    else:
        MODEL = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
    MODEL.eval()
    MODEL.to(DEVICE)


def load_nsfw_detector():
    global NSFW_DETECTOR
    if not config.NSFW_ENABLED:
        logger.info("NSFW detection disabled by config")
        return
    try:
        from nudenet import NudeDetector

        NSFW_DETECTOR = NudeDetector()
        logger.info("NSFW detector loaded (nudenet)")
    except Exception as error:
        logger.warning("NSFW detector failed to load: %s", error)
        NSFW_DETECTOR = None


def open_image_bytes(content: bytes) -> Image.Image | None:
    try:
        return Image.open(io.BytesIO(content)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        return None


def _to_tensor(image: Image.Image) -> torch.Tensor:
    if image.mode != "RGB":
        image = image.convert("RGB")
    width, height = image.size
    if max(width, height) > config.MAX_IMAGE_SIZE:
        ratio = config.MAX_IMAGE_SIZE / max(width, height)
        image = image.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
    return preprocess(image).unsqueeze(0).to(DEVICE)


def class_probabilities(image: Image.Image) -> torch.Tensor:
    with torch.no_grad():
        logits = MODEL(_to_tensor(image))
    return torch.softmax(logits[0], dim=0)


def top_labels(image: Image.Image, limit: int) -> list[str]:
    probabilities = class_probabilities(image)
    _, top_indices = torch.topk(probabilities, min(limit, len(LABELS)))
    labels: list[str] = []
    for class_index in top_indices.cpu().tolist():
        label = (
            LABELS[class_index].strip().lower().replace(" ", "_")
            if class_index < len(LABELS)
            else f"class_{class_index}"
        )
        if label not in labels:
            labels.append(label)
    return labels[:limit]


def class_scores(image: Image.Image, class_indices: list[int]) -> list[float]:
    probabilities = class_probabilities(image)
    return [
        float(probabilities[class_index].cpu().item())
        for class_index in class_indices
        if class_index < len(probabilities)
    ]


def nsfw_detections(image: Image.Image) -> list[tuple[str, float]]:
    if NSFW_DETECTOR is None:
        return []
    file_descriptor, image_path = None, None
    try:
        jpeg_buffer = io.BytesIO()
        image.save(jpeg_buffer, format="JPEG", quality=90)
        file_descriptor, image_path = tempfile.mkstemp(suffix=".jpg")
        os.write(file_descriptor, jpeg_buffer.getvalue())
        os.close(file_descriptor)
        file_descriptor = None
        detections = NSFW_DETECTOR.detect(image_path) or []
        results: list[tuple[str, float]] = []
        for detection in detections:
            class_name = (detection.get("class") or detection.get("label") or "").strip()
            if class_name:
                results.append((class_name, float(detection.get("score") or 0)))
        return results
    except Exception as error:
        logger.warning("NSFW detect error: %s", error)
        return []
    finally:
        if file_descriptor is not None:
            try:
                os.close(file_descriptor)
            except Exception:
                pass
        if image_path and os.path.exists(image_path):
            try:
                os.unlink(image_path)
            except Exception:
                pass

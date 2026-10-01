from pathlib import Path

import pytest
from PIL import Image

from vision import config
from vision.infra import models
from vision.service.vision import get_vision_service
from vision.training.eval_head import evaluate
from vision.training.train_head import train


def _write_images(root: Path) -> None:
    for label, color in (("cat", (255, 0, 0)), ("dog", (0, 0, 255))):
        folder = root / label
        folder.mkdir(parents=True)
        for index in range(2):
            Image.new("RGB", (64, 64), color).save(folder / f"{index}.png")


def test_should_train_head_and_serve_it_when_model_path_is_set(tmp_path, monkeypatch):
    _write_images(tmp_path / "data" / "train")
    output_dir = tmp_path / "out"

    train(tmp_path / "data", output_dir, epochs=1, batch_size=2, pretrained=False)
    report = evaluate(output_dir, tmp_path / "data" / "train")

    assert report["labels"] == ["cat", "dog"]
    assert sum(map(sum, report["confusion"])) == 4

    monkeypatch.setattr(config, "MODEL_PATH", str(output_dir / "model.pt"))
    monkeypatch.setattr(config, "LABELS_PATH", output_dir / "labels.json")
    models.load_labels()
    models.load_model()

    assert models.MODEL.fc.out_features == 2
    predictions = get_vision_service().predict_image(Image.new("RGB", (64, 64)))

    assert sorted(prediction.label for prediction in predictions) == ["cat", "dog"]
    assert sum(prediction.score for prediction in predictions) == pytest.approx(1.0, abs=1e-3)

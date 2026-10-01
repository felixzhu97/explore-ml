from pathlib import Path

from PIL import Image

import config
import service
from training.eval_head import evaluate
from training.train_head import train


def _write_images(root: Path) -> None:
    for label, color in (("cat", (255, 0, 0)), ("dog", (0, 0, 255))):
        folder = root / label
        folder.mkdir(parents=True)
        for i in range(2):
            Image.new("RGB", (64, 64), color).save(folder / f"{i}.png")


def test_should_train_head_and_serve_it_when_model_path_is_set(tmp_path, monkeypatch):
    _write_images(tmp_path / "data" / "train")
    out = tmp_path / "out"

    train(tmp_path / "data", out, epochs=1, batch_size=2, pretrained=False)
    report = evaluate(out, tmp_path / "data" / "train")

    assert report["labels"] == ["cat", "dog"]
    assert sum(map(sum, report["confusion"])) == 4

    monkeypatch.setattr(config, "MODEL_PATH", str(out / "model.pt"))
    monkeypatch.setattr(config, "LABELS_PATH", out / "labels.json")
    service.load_labels()
    service.load_model()

    assert service.MODEL.fc.out_features == 2
    assert service.predict_image(Image.new("RGB", (64, 64))) in (["cat", "dog"], ["dog", "cat"])

# Vision service — image labeling and content moderation (ResNet50 + NudeNet)

Package `vision` in the single Explore ML app (port 8000): `module.py` /
`config.py` / `controller/` / `service/` / `domain/` / `infra/` / `tests/` /
`training/`. Setup and run commands:
[`python_ml/README.md`](../README.md). The models load at startup.

## API

| Route | Input | Response |
| ----- | ----- | -------- |
| `POST /api/v1/images:predict` | multipart `file`, or JSON `{image_url}` | `{labels, predictions: [{label, score}]}` (top `TOP_K`) |
| `POST /api/v1/images:moderate` | multipart `file`, or JSON `{image_url}` | `{safe, categories, scores, thresholds, frames: []}` |
| `POST /api/v1/videos:moderate` | multipart `file`, or JSON `{video_url}` | `{safe, categories, scores, thresholds, frames: [{offset_seconds, scores, safe}]}` |

`categories` lists only flagged categories with their highest score.
`scores` holds every checked category (for video, its peak across frames)
and `thresholds` the cut-off for each. `frames` has one entry per sampled
video frame. In `GET /health` the module reports
`{status: "ok", model: "resnet50" | "fine_tuned"}`.

Images are limited to 10 MB and videos to 100 MB; larger uploads, missing
input and failed downloads return 400. Video moderation samples up to
`MAX_VIDEO_FRAMES` frames, one every `VIDEO_FRAME_INTERVAL_SEC`. With
`MODERATION_ENABLED = False`, both moderation routes return `{safe: true}`
without checking.

## Configuration

Constants in [`config.py`](config.py):

| Constant | Value |
| -------- | ----- |
| `MODEL_PATH` / `LABELS_PATH` | `None` / ImageNet labels (ResNet50) |
| `TOP_K` | `10` |
| `REQUEST_TIMEOUT` (seconds; doubled for video) | `15.0` |
| `MAX_IMAGE_SIZE` (pixels, longest side) | `800` |
| `MODERATION_ENABLED` / `MODERATION_THRESHOLD` | `True` / `0.15` |
| `NSFW_ENABLED` / `NSFW_THRESHOLD` | `True` / `0.35` |
| `MAX_VIDEO_FRAMES` / `VIDEO_FRAME_INTERVAL_SEC` | `30` / `2.0` |

## Fine-tuned classifier

Train a custom ResNet50 head, then point the module at it:

```bash
python -m vision.training.train_head --data <dir with train/<label>/> --output <dir> \
  [--epochs 5] [--batch-size 32] [--learning-rate 1e-3] [--unfreeze-layer4]
python -m vision.training.eval_head --model <dir> --data <dir with <label>/>
```

Then set `MODEL_PATH = "<dir>/model.pt"` and
`LABELS_PATH = Path("<dir>/labels.json")` in `config.py`.

With a custom head, moderation uses NudeNet only, because the prohibited-class
check relies on ImageNet ids. See the
[fine-tuning guide](../../docs/user-guide/fine-tuning.md).

## Tests

```bash
cd python_ml
pytest -q vision/tests
```

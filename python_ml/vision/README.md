# Vision service — image labeling and content moderation (ResNet50 + NudeNet)

Package `vision` in the single Explore ML app (port 8000): `module.py` /
`config.py` / `controller/` / `service/` / `domain/` / `infra/` / `tests/` /
`training/`. Setup, `.env` and run commands:
[`python_ml/README.md`](../README.md). The models load at startup.

## API

| Route | Input | Response |
| ----- | ----- | -------- |
| `POST /api/v1/images:predict` | multipart `file`, or JSON `{image_url}` | `{labels, predictions: [{label, score}]}` (top `VISION_TOP_K`) |
| `POST /api/v1/images:moderate` | multipart `file`, or JSON `{image_url}` | `{safe, categories, scores, thresholds, frames: []}` |
| `POST /api/v1/videos:moderate` | multipart `file`, or JSON `{video_url}` | `{safe, categories, scores, thresholds, frames: [{offset_seconds, scores, safe}]}` |

`categories` lists only flagged categories with their highest score.
`scores` holds every checked category (for video, its peak across frames)
and `thresholds` the cut-off for each. `frames` has one entry per sampled
video frame. In `GET /health` the module reports
`{status: "ok", model: "resnet50" | "fine_tuned"}`.

Images are limited to 10 MB and videos to 100 MB; larger uploads, missing
input and failed downloads return 400. Video moderation samples up to
`VISION_MAX_VIDEO_FRAMES` frames, one every `VISION_VIDEO_FRAME_INTERVAL_SEC`.
With `VISION_MODERATION_ENABLED=false`, both moderation routes return
`{safe: true}` without checking.

## Configuration

| Variable | Default |
| -------- | ------- |
| `VISION_MODEL_PATH` / `VISION_LABELS_PATH` | ImageNet ResNet50 |
| `VISION_TOP_K` | `10` |
| `VISION_REQUEST_TIMEOUT` (seconds; doubled for video) | `15.0` |
| `VISION_MAX_IMAGE_SIZE` (pixels, longest side) | `800` |
| `VISION_MODERATION_ENABLED` / `VISION_MODERATION_THRESHOLD` | `true` / `0.15` |
| `VISION_NSFW_ENABLED` / `VISION_NSFW_THRESHOLD` | `true` / `0.35` |
| `VISION_MAX_VIDEO_FRAMES` / `VISION_VIDEO_FRAME_INTERVAL_SEC` | `30` / `2.0` |

## Fine-tuned classifier

Train a custom ResNet50 head, then point the module at it:

```bash
python -m vision.training.train_head --data <dir with train/<label>/> --output <dir> \
  [--epochs 5] [--batch-size 32] [--learning-rate 1e-3] [--unfreeze-layer4]
python -m vision.training.eval_head --model <dir> --data <dir with <label>/>
export VISION_MODEL_PATH=<dir>/model.pt VISION_LABELS_PATH=<dir>/labels.json
```

With a custom head, moderation uses NudeNet only, because the prohibited-class
check relies on ImageNet ids. See the
[fine-tuning guide](../../docs/user-guide/fine-tuning.md).

## Tests

```bash
cd python_ml
pytest -q vision/tests
```

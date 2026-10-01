# Vision service — image labeling and content moderation (ResNet50 + NudeNet)

Layout (same as other Python helpers): `main.py` / `config.py` / `controller/` /
`service/` / `domain/` / `infra/` / `tests/` / `training/`.

Port **8001** (`VISION_PORT`; `PORT` is ignored).

## Setup

```bash
cd python_ml/vision
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Or: `uvicorn main:app --host 0.0.0.0 --port 8001`

`.env.example` lists the variables, but this helper does not load `.env`;
export them in your shell. The model loads at startup.

## API

| Route | Input | Response |
| ----- | ----- | -------- |
| `GET /health` | — | `{status: "ok", model: "resnet50"}` |
| `POST /api/v1/images:predict` | multipart `file`, or JSON `{image_url}` | `{labels: [...]}` (top `VISION_TOP_K`) |
| `POST /api/v1/images:moderate` | multipart `file`, or JSON `{image_url}` | `{safe, categories: [{label, score}]}` |
| `POST /api/v1/videos:moderate` | multipart `file`, or JSON `{video_url}` | `{safe, categories: [{label, score}]}` |

Images are limited to 10 MB and videos to 100 MB; larger uploads, missing
input and failed downloads return 400. Video moderation samples up to
`VISION_MAX_VIDEO_FRAMES` frames, one every `VISION_VIDEO_FRAME_INTERVAL_SEC`.
With `VISION_MODERATION_ENABLED=false`, both moderation routes return
`{safe: true}` without checking.

## Configuration

| Variable | Default |
| -------- | ------- |
| `VISION_HOST` / `VISION_PORT` | `0.0.0.0` / `8001` |
| `VISION_MODEL_PATH` / `VISION_LABELS_PATH` | ImageNet ResNet50 |
| `VISION_TOP_K` | `10` |
| `VISION_REQUEST_TIMEOUT` (seconds; doubled for video) | `15.0` |
| `VISION_MAX_IMAGE_SIZE` (pixels, longest side) | `800` |
| `VISION_MODERATION_ENABLED` / `VISION_MODERATION_THRESHOLD` | `true` / `0.15` |
| `VISION_NSFW_ENABLED` / `VISION_NSFW_THRESHOLD` | `true` / `0.35` |
| `VISION_MAX_VIDEO_FRAMES` / `VISION_VIDEO_FRAME_INTERVAL_SEC` | `30` / `2.0` |

## Fine-tuned classifier

Train a custom ResNet50 head, then point the helper at it:

```bash
python -m training.train_head --data <dir with train/<label>/> --output <dir> \
  [--epochs 5] [--batch-size 32] [--learning-rate 1e-3] [--unfreeze-layer4]
python -m training.eval_head --model <dir> --data <dir with <label>/>
export VISION_MODEL_PATH=<dir>/model.pt VISION_LABELS_PATH=<dir>/labels.json
```

With a custom head, moderation uses NudeNet only, because the prohibited-class
check relies on ImageNet ids. See the
[fine-tuning guide](../../docs/user-guide/fine-tuning.md).

## Tests

```bash
pytest -q   # test_health.py, test_fine_tuning.py, test_moderation_api.py
```

## Docker

```bash
docker build -t explore-vision .
docker run -p 8001:8001 explore-vision
```

# Vision service — image labeling and content moderation (ResNet50 + NudeNet)

Layout (same as other Python helpers): `main.py` / `config.py` / `controller/` / `service/` / `domain/` / `infra/` / `tests/`.

Port **8001**. Endpoints: `/health`, `POST /api/v1/images:predict`, `POST /api/v1/images:moderate`, `POST /api/v1/videos:moderate`.

## Setup

```bash
cd src/main/ml/vision
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Or: `uvicorn main:app --host 0.0.0.0 --port 8001`

Copy `.env.example` to `.env` and adjust as needed. Server expects `VISION_SERVICE_URL=http://localhost:8001`.

## Fine-tuned classifier

Train a custom ResNet50 head with `python -m training.train_head`, then set `VISION_MODEL_PATH=<dir>/model.pt` and `VISION_LABELS_PATH=<dir>/labels.json`. With a custom head, moderation uses NudeNet only, because the prohibited-class check relies on ImageNet ids. See the [fine-tuning guide](../../docs/user-guide/fine-tuning.md).

## Docker

```bash
docker build -t whatsfeed-vision .
docker run -p 8001:8001 whatsfeed-vision
```

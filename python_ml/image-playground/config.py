import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
try:
    import numpy  # noqa: F401
except ImportError:
    raise SystemExit("numpy is required. Install with: pip install 'numpy>=1.24.0,<3.0.0'")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
if "HF_ENDPOINT" not in os.environ:
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

from pathlib import Path

OUTPUT_BASE = Path(os.environ.get("IMAGE_PLAYGROUND_OUTPUT_DIR", "output"))
IMAGE_OUTPUT = OUTPUT_BASE / "image"
IMAGE_OUTPUT.mkdir(parents=True, exist_ok=True)

HOST = os.environ.get("IMAGE_PLAYGROUND_HOST", "0.0.0.0")
PORT = int(os.environ.get("IMAGE_PLAYGROUND_PORT", os.environ.get("PORT", "8003")))
BASE_URL = os.environ.get("IMAGE_PLAYGROUND_BASE_URL", f"http://localhost:{PORT}")

LOCAL_MODELS_ROOT = Path(
    os.environ.get("LOCAL_MODELS_ROOT", str(Path.home() / "Codes" / "models"))
).expanduser()

IMAGE_BACKEND = os.environ.get("IMAGE_BACKEND", "qwen").strip().lower()
_DEFAULT_IMAGE_MODEL = {
    "qwen": str(LOCAL_MODELS_ROOT / "image" / "models" / "Qwen-Image"),
    "sd": "runwayml/stable-diffusion-v1-5",
}
IMAGE_MODEL = (
    os.environ.get("IMAGE_MODEL")
    or os.environ.get("SD_MODEL")
    or _DEFAULT_IMAGE_MODEL.get(IMAGE_BACKEND, _DEFAULT_IMAGE_MODEL["qwen"])
)

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

OUTPUT_BASE = Path(os.environ.get("VIDEO_OUTPUT_DIR", "output"))
VIDEO_OUTPUT = OUTPUT_BASE / "video"
VIDEO_OUTPUT.mkdir(parents=True, exist_ok=True)

HOST = os.environ.get("VIDEO_HOST", "0.0.0.0")
PORT = int(os.environ.get("VIDEO_PORT", os.environ.get("PORT", "8005")))
BASE_URL = os.environ.get("VIDEO_BASE_URL", f"http://localhost:{PORT}")

COGVIDEOX_MODEL = os.environ.get("COGVIDEOX_MODEL", "THUDM/CogVideoX-2b")

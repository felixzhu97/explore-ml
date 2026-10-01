"""Settings shared by every module. Only secrets come from python_ml/.env."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

HOST = "0.0.0.0"
PORT = 8000
BASE_URL = f"http://localhost:{PORT}"
LOCAL_MODELS_ROOT = Path.home() / "Codes" / "models"

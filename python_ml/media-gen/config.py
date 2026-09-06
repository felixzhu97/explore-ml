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

OUTPUT_BASE = Path(os.environ.get("MEDIA_OUTPUT_DIR", "output"))
IMAGE_OUTPUT = OUTPUT_BASE / "image"
VIDEO_OUTPUT = OUTPUT_BASE / "video"
VOICE_OUTPUT = OUTPUT_BASE / "voice"
for d in (IMAGE_OUTPUT, VIDEO_OUTPUT, VOICE_OUTPUT):
    d.mkdir(parents=True, exist_ok=True)

HOST = os.environ.get("MEDIA_GEN_HOST", "0.0.0.0")
PORT = int(os.environ.get("MEDIA_GEN_PORT", os.environ.get("PORT", "8003")))
BASE_URL = os.environ.get("MEDIA_GEN_BASE_URL", f"http://localhost:{PORT}")

# Local Qwen weights root (override with LOCAL_MODELS_ROOT).
LOCAL_MODELS_ROOT = Path(
    os.environ.get("LOCAL_MODELS_ROOT", str(Path.home() / "Codes" / "models"))
).expanduser()

# Image: default local Qwen-Image; set IMAGE_BACKEND=sd for Stable Diffusion.
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

# Voice: default local Qwen3-TTS; set VOICE_BACKEND=edge for edge-tts.
VOICE_BACKEND = os.environ.get("VOICE_BACKEND", "qwen").strip().lower()
TTS_MODEL = os.environ.get(
    "TTS_MODEL",
    str(LOCAL_MODELS_ROOT / "tts" / "models" / "Qwen3-TTS-12Hz-1.7B-CustomVoice"),
)
TTS_LANGUAGE = os.environ.get("TTS_LANGUAGE", "Chinese")
TTS_SPEAKER = os.environ.get("TTS_SPEAKER", "")
DEFAULT_VOICE = os.environ.get("EDGE_TTS_VOICE", "zh-CN-XiaoxiaoNeural")
VOICE_EXT = "wav" if VOICE_BACKEND == "qwen" else "mp3"
VOICE_MEDIA_TYPE = "audio/wav" if VOICE_BACKEND == "qwen" else "audio/mpeg"


COGVIDEOX_MODEL = os.environ.get("COGVIDEOX_MODEL", "THUDM/CogVideoX-2b")

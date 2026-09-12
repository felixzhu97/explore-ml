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

OUTPUT_BASE = Path(os.environ.get("SPEECH_OUTPUT_DIR", "output"))
VOICE_OUTPUT = OUTPUT_BASE / "voice"
ASR_UPLOADS = OUTPUT_BASE / "asr"
for d in (VOICE_OUTPUT, ASR_UPLOADS):
    d.mkdir(parents=True, exist_ok=True)

HOST = os.environ.get("SPEECH_HOST", "0.0.0.0")
PORT = int(os.environ.get("SPEECH_PORT", os.environ.get("PORT", "8004")))
BASE_URL = os.environ.get("SPEECH_BASE_URL", f"http://localhost:{PORT}")

LOCAL_MODELS_ROOT = Path(
    os.environ.get("LOCAL_MODELS_ROOT", str(Path.home() / "Codes" / "models"))
).expanduser()

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

ASR_BACKEND = os.environ.get("ASR_BACKEND", "qwen").strip().lower()
ASR_MODEL = os.environ.get(
    "ASR_MODEL",
    str(LOCAL_MODELS_ROOT / "asr" / "models" / "Qwen3-ASR-1.7B"),
)
ASR_LANGUAGE = os.environ.get("ASR_LANGUAGE", "")
ASR_STREAM_BACKEND = os.environ.get("ASR_STREAM_BACKEND", "rolling").strip().lower()
ASR_STREAM_PARTIAL_INTERVAL_SEC = float(
    os.environ.get("ASR_STREAM_PARTIAL_INTERVAL_SEC", "1.0")
)
ASR_STREAM_MIN_PARTIAL_BYTES = int(
    os.environ.get("ASR_STREAM_MIN_PARTIAL_BYTES", str(16000 * 2))
)

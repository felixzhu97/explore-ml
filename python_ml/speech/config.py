from pathlib import Path

from config import BASE_URL, LOCAL_MODELS_ROOT

OUTPUT_BASE = Path(__file__).parent / "output"
VOICE_OUTPUT = OUTPUT_BASE / "voice"
ASR_UPLOADS = OUTPUT_BASE / "asr"
for directory in (VOICE_OUTPUT, ASR_UPLOADS):
    directory.mkdir(parents=True, exist_ok=True)

VOICE_BACKEND = "qwen"
TTS_MODEL = str(LOCAL_MODELS_ROOT / "tts" / "models" / "Qwen3-TTS-12Hz-1.7B-CustomVoice")
TTS_LANGUAGE = "Chinese"
TTS_SPEAKER = ""
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
VOICE_EXTENSION = "wav" if VOICE_BACKEND == "qwen" else "mp3"
VOICE_MEDIA_TYPE = "audio/wav" if VOICE_BACKEND == "qwen" else "audio/mpeg"

ASR_BACKEND = "qwen"
ASR_MODEL = str(LOCAL_MODELS_ROOT / "asr" / "models" / "Qwen3-ASR-1.7B")
ASR_LANGUAGE = ""
ASR_STREAM_PARTIAL_INTERVAL_SEC = 1.0
ASR_STREAM_MIN_PARTIAL_BYTES = 16000 * 2

from pathlib import Path

from config import BASE_URL

VIDEO_OUTPUT = Path(__file__).parent / "output" / "video"
VIDEO_OUTPUT.mkdir(parents=True, exist_ok=True)

COGVIDEOX_MODEL = "THUDM/CogVideoX-2b"

from pathlib import Path

from config import BASE_URL, LOCAL_MODELS_ROOT

IMAGE_OUTPUT = Path(__file__).parent / "output" / "image"
IMAGE_OUTPUT.mkdir(parents=True, exist_ok=True)

IMAGE_BACKEND = "qwen"
IMAGE_MODEL = {
    "qwen": str(LOCAL_MODELS_ROOT / "image" / "models" / "Qwen-Image"),
    "sd": "runwayml/stable-diffusion-v1-5",
}[IMAGE_BACKEND]
IMAGE_LORA_PATH = None
IMAGE_LORA_SCALE = 1.0

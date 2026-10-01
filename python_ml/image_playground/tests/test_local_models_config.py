from pathlib import Path

from image_playground import config


def test_should_default_image_backend_to_qwen():
    assert config.IMAGE_BACKEND == "qwen"


def test_should_resolve_image_model_under_local_models_root():
    root = Path(config.LOCAL_MODELS_ROOT)
    assert Path(config.IMAGE_MODEL) == root / "image" / "models" / "Qwen-Image"


def test_should_build_asset_urls_on_the_shared_port():
    assert config.BASE_URL == "http://localhost:8000"

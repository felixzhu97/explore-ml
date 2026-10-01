from video import config


def test_should_build_asset_urls_on_the_shared_port():
    assert config.BASE_URL == "http://localhost:8000"


def test_should_default_cogvideox_model():
    assert config.COGVIDEOX_MODEL == "THUDM/CogVideoX-2b"

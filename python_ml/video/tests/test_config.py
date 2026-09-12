import config


def test_should_default_port_to_8005():
    assert config.PORT == 8005


def test_should_default_cogvideox_model():
    assert config.COGVIDEOX_MODEL == "THUDM/CogVideoX-2b"

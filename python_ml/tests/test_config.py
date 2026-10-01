import pytest

import config


def test_should_enable_every_module_when_unset():
    assert config.enabled_modules("") == config.MODULE_NAMES


def test_should_enable_listed_modules_in_canonical_order():
    assert config.enabled_modules(" speech, rag ") == ("rag", "speech")


def test_should_reject_unknown_modules():
    with pytest.raises(ValueError, match="image-playground"):
        config.enabled_modules("rag,image-playground")


def test_should_default_to_port_8000():
    assert config.PORT == 8000

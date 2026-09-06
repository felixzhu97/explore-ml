from pathlib import Path

import config


def test_should_default_image_backend_to_qwen():
    assert config.IMAGE_BACKEND == "qwen"


def test_should_default_voice_backend_to_qwen():
    assert config.VOICE_BACKEND == "qwen"


def test_should_resolve_image_model_under_local_models_root():
    root = Path(config.LOCAL_MODELS_ROOT)
    assert Path(config.IMAGE_MODEL) == root / "image" / "models" / "Qwen-Image"


def test_should_resolve_tts_model_under_local_models_root():
    root = Path(config.LOCAL_MODELS_ROOT)
    assert Path(config.TTS_MODEL) == (
        root / "tts" / "models" / "Qwen3-TTS-12Hz-1.7B-CustomVoice"
    )


def test_should_use_wav_for_qwen_voice():
    assert config.VOICE_EXT == "wav"
    assert config.VOICE_MEDIA_TYPE == "audio/wav"


def test_should_default_asr_backend_to_qwen():
    assert config.ASR_BACKEND == "qwen"


def test_should_resolve_asr_model_under_local_models_root():
    root = Path(config.LOCAL_MODELS_ROOT)
    assert Path(config.ASR_MODEL) == root / "asr" / "models" / "Qwen3-ASR-1.7B"

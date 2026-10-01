from pathlib import Path

import config
from infra import pipeline
from training.train_lora import build_command, parse_args


class FakeDiffusionPipeline:
    def __init__(self):
        self.calls = []

    def load_lora_weights(self, path, adapter_name):
        self.calls.append(("load", path, adapter_name))

    def set_adapters(self, names, adapter_weights):
        self.calls.append(("set", names, adapter_weights))


def test_should_skip_lora_when_path_is_unset(monkeypatch):
    monkeypatch.setattr(config, "IMAGE_LORA_PATH", None)
    diffusion_pipeline = FakeDiffusionPipeline()

    pipeline.apply_lora(diffusion_pipeline)

    assert diffusion_pipeline.calls == []


def test_should_load_lora_with_scale_when_path_is_set(monkeypatch):
    monkeypatch.setattr(config, "IMAGE_LORA_PATH", "/loras/my-style")
    monkeypatch.setattr(config, "IMAGE_LORA_SCALE", 0.8)
    diffusion_pipeline = FakeDiffusionPipeline()

    pipeline.apply_lora(diffusion_pipeline)

    assert diffusion_pipeline.calls == [
        ("load", "/loras/my-style", "fine_tuned"),
        ("set", ["fine_tuned"], [0.8]),
    ]


def test_should_push_lora_to_hub_when_push_to_is_given():
    args = parse_args(["--dataset", "me/style", "--instance-prompt", "x", "--push-to", "me/lora"])

    command = build_command(args, Path("train.py"))

    assert command[command.index("--dataset_name") + 1] == "me/style"
    assert command[-3:] == ["--push_to_hub", "--hub_model_id", "me/lora"]

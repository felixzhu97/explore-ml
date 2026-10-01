from __future__ import annotations

import threading

from image_playground import config

image_pipeline = None
pipeline_lock = threading.Lock()
LORA_ADAPTER_NAME = "fine_tuned"


def _ensure_torch_xpu_stub():
    import torch

    if getattr(torch, "xpu", None) is not None:
        return
    from types import SimpleNamespace

    def _noop(*args, **kwargs):
        return None

    def _noop_false(*args, **kwargs):
        return False

    def _noop_zero(*args, **kwargs):
        return 0

    stub = SimpleNamespace(
        is_available=_noop_false,
        empty_cache=_noop,
        device_count=_noop_zero,
        synchronize=_noop,
        manual_seed=_noop,
        set_device=_noop,
        current_device=lambda: 0,
    )
    torch.xpu = stub


def _ensure_torch_distributed_device_mesh():
    import torch

    if not hasattr(torch, "distributed") or torch.distributed is None:
        return
    if getattr(torch.distributed, "device_mesh", None) is not None:
        return
    from types import ModuleType, SimpleNamespace

    stub_module = ModuleType("device_mesh")
    mesh_stub = SimpleNamespace(get_group=lambda *args, **kwargs: None)

    class _DeviceMeshStub:
        def get_group(self, *args, **kwargs):
            return None

    stub_module.DeviceMesh = _DeviceMeshStub

    def _init_device_mesh(*args, **kwargs):
        return mesh_stub

    stub_module.init_device_mesh = _init_device_mesh
    torch.distributed.device_mesh = stub_module


def _select_device() -> str:
    import torch

    if torch.cuda.is_available():
        return "cuda"
    mps_backend = getattr(torch.backends, "mps", None)
    if mps_backend is not None and mps_backend.is_available():
        return "mps"
    return "cpu"


def get_image_pipeline():
    global image_pipeline
    with pipeline_lock:
        if image_pipeline is None:
            try:
                import numpy as np

                _ = np.__version__
            except ImportError as error:
                raise RuntimeError(
                    "numpy is required for image generation. Install with: pip install numpy"
                ) from error
            import torch

            _ensure_torch_xpu_stub()
            _ensure_torch_distributed_device_mesh()
            import torchvision

            _ = getattr(torchvision, "__version__", None)
            model_id = config.IMAGE_MODEL
            device = _select_device()
            if config.IMAGE_BACKEND == "sd":
                from diffusers import StableDiffusionPipeline

                image_pipeline = StableDiffusionPipeline.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16 if device != "cpu" else torch.float32,
                )
            else:
                from diffusers import DiffusionPipeline

                if device == "mps":
                    dtype = torch.bfloat16
                elif device == "cpu":
                    dtype = torch.float32
                else:
                    dtype = torch.float16
                image_pipeline = DiffusionPipeline.from_pretrained(
                    model_id,
                    torch_dtype=dtype,
                )
            apply_lora(image_pipeline)
            image_pipeline = image_pipeline.to(device)
    return image_pipeline


def apply_lora(diffusion_pipeline) -> None:
    if not config.IMAGE_LORA_PATH:
        return
    diffusion_pipeline.load_lora_weights(config.IMAGE_LORA_PATH, adapter_name=LORA_ADAPTER_NAME)
    diffusion_pipeline.set_adapters(
        [LORA_ADAPTER_NAME], adapter_weights=[config.IMAGE_LORA_SCALE]
    )


def generate(prompt: str, negative_prompt: str, output_path) -> None:
    diffusion_pipeline = get_image_pipeline()
    if config.IMAGE_BACKEND == "sd":
        result = diffusion_pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt or None,
            num_inference_steps=30,
            guidance_scale=7.5,
        )
    else:
        result = diffusion_pipeline(
            prompt,
            negative_prompt=negative_prompt or " ",
            num_inference_steps=20,
        )
        import torch

        if _select_device() == "mps" and hasattr(torch, "mps"):
            try:
                torch.mps.synchronize()
            except Exception:
                pass
    result.images[0].save(str(output_path))

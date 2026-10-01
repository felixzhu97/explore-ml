from __future__ import annotations

import threading

from video import config

video_pipeline = None
pipeline_lock = threading.Lock()


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


def skip_video_local() -> bool:
    import sys

    if sys.platform != "darwin":
        return False
    import torch

    if torch.cuda.is_available():
        return False
    return True


def get_video_pipeline():
    global video_pipeline
    if skip_video_local():
        return None
    with pipeline_lock:
        if video_pipeline is None:
            import torch

            _ensure_torch_xpu_stub()
            _ensure_torch_distributed_device_mesh()
            import torchvision

            _ = getattr(torchvision, "__version__", None)
            from diffusers import CogVideoXPipeline

            model_id = config.COGVIDEOX_MODEL
            device = _select_device()
            video_pipeline = CogVideoXPipeline.from_pretrained(
                model_id,
                torch_dtype=torch.float16,
            )
            if device == "cuda":
                video_pipeline.enable_model_cpu_offload()
            else:
                video_pipeline = video_pipeline.to(device)
    return video_pipeline


def generate(prompt: str, output_path) -> bool:
    """Write the video to output_path; False when local generation is skipped."""
    diffusion_pipeline = get_video_pipeline()
    if diffusion_pipeline is None:
        return False
    from diffusers.utils import export_to_video

    frames = diffusion_pipeline(
        prompt=prompt,
        num_inference_steps=50,
        guidance_scale=6.0,
    ).frames[0]
    export_to_video(frames, str(output_path), fps=8)
    return True

from __future__ import annotations

import os
import threading

import config

image_jobs = {}
jobs_lock = threading.Lock()
image_pipe = None
pipe_lock = threading.Lock()


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
    _mesh_stub = SimpleNamespace(get_group=lambda *a, **k: None)

    class _DeviceMeshStub:
        def get_group(self, *args, **kwargs):
            return None

    stub_module.DeviceMesh = _DeviceMeshStub

    def _init_device_mesh(*args, **kwargs):
        return _mesh_stub

    stub_module.init_device_mesh = _init_device_mesh
    torch.distributed.device_mesh = stub_module


def _device():
    import torch

    if os.environ.get("IMAGE_PLAYGROUND_DEVICE") == "cpu":
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def get_image_pipeline():
    global image_pipe
    with pipe_lock:
        if image_pipe is None:
            try:
                import numpy as np

                _ = np.__version__
            except ImportError as e:
                raise RuntimeError(
                    "numpy is required for image generation. Install with: pip install numpy"
                ) from e
            import torch

            _ensure_torch_xpu_stub()
            _ensure_torch_distributed_device_mesh()
            import torchvision

            _ = getattr(torchvision, "__version__", None)
            model_id = config.IMAGE_MODEL
            device = _device()
            if config.IMAGE_BACKEND == "sd":
                from diffusers import StableDiffusionPipeline

                image_pipe = StableDiffusionPipeline.from_pretrained(
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
                image_pipe = DiffusionPipeline.from_pretrained(
                    model_id,
                    torch_dtype=dtype,
                )
            image_pipe = image_pipe.to(device)
    return image_pipe


def run_image_job(job_id: str, prompt: str, negative_prompt: str):
    try:
        pipe = get_image_pipeline()
        out_path = config.IMAGE_OUTPUT / f"{job_id}.png"
        if config.IMAGE_BACKEND == "sd":
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt or None,
                num_inference_steps=30,
                guidance_scale=7.5,
            )
        else:
            result = pipe(
                prompt,
                negative_prompt=negative_prompt or " ",
                num_inference_steps=20,
            )
            import torch

            if _device() == "mps" and hasattr(torch, "mps"):
                try:
                    torch.mps.synchronize()
                except Exception:
                    pass
        result.images[0].save(str(out_path))
        with jobs_lock:
            if job_id in image_jobs:
                image_jobs[job_id]["status"] = "succeeded"
                image_jobs[job_id]["image_url"] = (
                    f"{config.BASE_URL}/output/image/{job_id}.png"
                )
    except Exception as e:
        with jobs_lock:
            if job_id in image_jobs:
                image_jobs[job_id]["status"] = "failed"
                image_jobs[job_id]["error"] = str(e)

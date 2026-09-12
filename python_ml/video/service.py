from __future__ import annotations

import os
import threading

import config

video_jobs = {}
jobs_lock = threading.Lock()
video_pipe = None
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

    if os.environ.get("VIDEO_DEVICE") == "cpu":
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def skip_video_local():
    if os.environ.get("VIDEO_GEN_FORCE_LOCAL") == "1":
        return False
    if os.environ.get("VIDEO_FORCE_LOCAL") == "1":
        return False
    import sys

    if sys.platform != "darwin":
        return False
    import torch

    if torch.cuda.is_available():
        return False
    return True


def get_video_pipeline():
    global video_pipe
    if skip_video_local():
        return None
    with pipe_lock:
        if video_pipe is None:
            import torch

            _ensure_torch_xpu_stub()
            _ensure_torch_distributed_device_mesh()
            import torchvision

            _ = getattr(torchvision, "__version__", None)
            from diffusers import CogVideoXPipeline

            model_id = config.COGVIDEOX_MODEL
            device = _device()
            video_pipe = CogVideoXPipeline.from_pretrained(
                model_id,
                torch_dtype=torch.float16,
            )
            if device == "cuda":
                video_pipe.enable_model_cpu_offload()
            else:
                video_pipe = video_pipe.to(device)
    return video_pipe


def run_video_job(job_id: str, prompt: str):
    try:
        pipe = get_video_pipeline()
        if pipe is None:
            with jobs_lock:
                if job_id in video_jobs:
                    video_jobs[job_id]["status"] = "failed"
                    video_jobs[job_id]["error"] = (
                        "Local video generation not supported on this platform. "
                        "Set VIDEO_FORCE_LOCAL=1 to try anyway."
                    )
            return
        out_path = config.VIDEO_OUTPUT / f"{job_id}.mp4"
        from diffusers.utils import export_to_video

        video = pipe(
            prompt=prompt,
            num_inference_steps=50,
            guidance_scale=6.0,
        ).frames[0]
        export_to_video(video, str(out_path), fps=8)
        with jobs_lock:
            if job_id in video_jobs:
                video_jobs[job_id]["status"] = "succeeded"
                video_jobs[job_id]["video_url"] = (
                    f"{config.BASE_URL}/output/video/{job_id}.mp4"
                )
    except Exception as e:
        with jobs_lock:
            if job_id in video_jobs:
                video_jobs[job_id]["status"] = "failed"
                video_jobs[job_id]["error"] = str(e)

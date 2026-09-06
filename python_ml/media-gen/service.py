from __future__ import annotations

import os
import threading

import config

image_jobs = {}
video_jobs = {}
jobs_lock = threading.Lock()
image_pipe = None
video_pipe = None
tts_model = None
asr_model = None
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

    if os.environ.get("MEDIA_GEN_DEVICE") == "cpu":
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
    if os.environ.get("MEDIA_VIDEO_FORCE_LOCAL") == "1":
        return False
    import sys

    if sys.platform != "darwin":
        return False
    import torch

    if torch.cuda.is_available():
        return False
    return True


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


def get_tts_model():
    global tts_model
    with pipe_lock:
        if tts_model is None:
            import torch
            from qwen_tts import Qwen3TTSModel

            device = _device()
            dtype = torch.float16 if device in ("mps", "cuda") else torch.float32
            tts_model = Qwen3TTSModel.from_pretrained(
                config.TTS_MODEL,
                device_map=device,
                dtype=dtype,
            )
    return tts_model


def get_asr_model():
    global asr_model
    with pipe_lock:
        if asr_model is None:
            if config.ASR_BACKEND != "qwen":
                raise RuntimeError(
                    f"Unsupported ASR_BACKEND={config.ASR_BACKEND!r}; use qwen"
                )
            import torch
            from qwen_asr import Qwen3ASRModel

            device = _device()
            if device == "mps":
                dtype = torch.float16
            elif device == "cuda":
                dtype = torch.bfloat16
            else:
                dtype = torch.float32
            asr_model = Qwen3ASRModel.from_pretrained(
                config.ASR_MODEL,
                dtype=dtype,
                device_map=device,
                max_inference_batch_size=1,
                max_new_tokens=512,
            )
    return asr_model


def _transcribe_qwen(audio_path: str, language: str | None) -> dict:
    asr = get_asr_model()
    lang = language or config.ASR_LANGUAGE or None
    results = asr.transcribe(audio=audio_path, language=lang or None)
    if not results:
        return {"text": "", "language": lang or ""}
    first = results[0]
    text = getattr(first, "text", None)
    if text is None and isinstance(first, dict):
        text = first.get("text", "")
    if text is None:
        text = str(first)
    detected = getattr(first, "language", None)
    if detected is None and isinstance(first, dict):
        detected = first.get("language", "")
    return {"text": text or "", "language": detected or lang or ""}


async def transcribe_audio(audio_path: str, language: str | None = None) -> dict:
    import asyncio

    return await asyncio.to_thread(_transcribe_qwen, audio_path, language)


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
                image_jobs[job_id]["image_url"] = f"{config.BASE_URL}/output/image/{job_id}.png"
    except Exception as e:
        with jobs_lock:
            if job_id in image_jobs:
                image_jobs[job_id]["status"] = "failed"
                image_jobs[job_id]["error"] = str(e)


def run_video_job(job_id: str, prompt: str):
    try:
        pipe = get_video_pipeline()
        if pipe is None:
            with jobs_lock:
                if job_id in video_jobs:
                    video_jobs[job_id]["status"] = "failed"
                    video_jobs[job_id]["error"] = (
                        "Local video generation not supported on this platform. "
                        "Set MEDIA_VIDEO_FORCE_LOCAL=1 to try anyway."
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
                video_jobs[job_id]["video_url"] = f"{config.BASE_URL}/output/video/{job_id}.mp4"
    except Exception as e:
        with jobs_lock:
            if job_id in video_jobs:
                video_jobs[job_id]["status"] = "failed"
                video_jobs[job_id]["error"] = str(e)


def _synthesize_qwen_voice(text: str, speaker: str, out_path) -> None:
    import numpy as np
    import soundfile as sf
    import torch

    tts = get_tts_model()
    speakers = tts.get_supported_speakers()
    chosen = speaker or config.TTS_SPEAKER or (speakers[0] if speakers else "vivian")
    waves, sr = tts.generate_custom_voice(
        text=text,
        speaker=chosen,
        language=config.TTS_LANGUAGE,
        non_streaming_mode=True,
    )
    audio = waves[0]
    if isinstance(audio, torch.Tensor):
        audio = audio.detach().cpu().numpy()
    audio = np.asarray(audio, dtype=np.float32)
    sf.write(str(out_path), audio, sr)


async def synthesize_voice(text: str, voice: str, job_id: str, out_path):
    if config.VOICE_BACKEND == "edge":
        import edge_tts

        communicate = edge_tts.Communicate(text, voice or config.DEFAULT_VOICE)
        await communicate.save(str(out_path))
        return

    import asyncio

    await asyncio.to_thread(_synthesize_qwen_voice, text, voice or "", out_path)

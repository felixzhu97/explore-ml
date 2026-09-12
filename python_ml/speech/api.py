import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel

import config
import service
from streaming_asr import StreamingAsrSession

router = APIRouter()

_ALLOWED_AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm", ".aac"}


class VoiceSynthesizeBody(BaseModel):
    text: str
    voice: Optional[str] = None


@router.post("/api/v1/voices:synthesize")
async def voice_synthesize(body: VoiceSynthesizeBody):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if config.VOICE_BACKEND == "edge":
        voice = (body.voice or config.DEFAULT_VOICE).strip()
    else:
        voice = (body.voice or config.TTS_SPEAKER or "").strip()
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    out_path = config.VOICE_OUTPUT / f"{job_id}.{config.VOICE_EXT}"
    try:
        await service.synthesize_voice(body.text.strip(), voice, job_id, out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "audio_url": f"{config.BASE_URL}/output/voice/{job_id}.{config.VOICE_EXT}"
    }


@router.get("/output/voice/{job_id}.mp3")
def serve_voice_mp3(job_id: str):
    path = config.VOICE_OUTPUT / f"{job_id}.mp3"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="audio/mpeg")


@router.get("/output/voice/{job_id}.wav")
def serve_voice_wav(job_id: str):
    path = config.VOICE_OUTPUT / f"{job_id}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="audio/wav")


@router.post("/api/v1/audios:transcribe")
async def audios_transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe uploaded audio with local Qwen3-ASR (default)."""
    suffix = Path(file.filename or "audio.wav").suffix.lower() or ".wav"
    if suffix not in _ALLOWED_AUDIO_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type {suffix}. Allowed: {', '.join(sorted(_ALLOWED_AUDIO_SUFFIXES))}",
        )
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    tmp_path = config.ASR_UPLOADS / f"{job_id}{suffix}"
    try:
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="empty audio file")
        tmp_path.write_bytes(data)
        result = await service.transcribe_audio(
            str(tmp_path),
            (language or "").strip() or None,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        try:
            if tmp_path.exists():
                os.unlink(tmp_path)
        except OSError:
            pass
    return {
        "text": result.get("text", ""),
        **({"language": result["language"]} if result.get("language") else {}),
    }


@router.websocket("/ws/v1/audios:transcribe")
async def audios_transcribe_stream(websocket: WebSocket):
    """
    Streaming ASR over WebSocket (Qwen3-ASR rolling buffer by default).

    Client → server:
      {"type":"audio","data":"<base64 pcm|wav>","sample_rate":16000}
      {"type":"commit"}
      {"type":"stop"}
    Server → client:
      {"type":"partial"|"final"|"error","text":"..."}
    """
    await websocket.accept()
    session = StreamingAsrSession(
        transcribe_fn=service._transcribe_qwen,
        sample_rate=16000,
        language=(config.ASR_LANGUAGE or None) or None,
        partial_interval_sec=config.ASR_STREAM_PARTIAL_INTERVAL_SEC,
        min_partial_bytes=config.ASR_STREAM_MIN_PARTIAL_BYTES,
        uploads_dir=config.ASR_UPLOADS,
    )
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "text": "invalid JSON"})
                continue
            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "text": "message must be object"})
                continue
            msg_type = message.get("type")
            if msg_type == "audio":
                data = message.get("data")
                if not isinstance(data, str) or not data.strip():
                    continue
                sr = message.get("sample_rate")
                event = session.append_audio(
                    data, sample_rate=int(sr) if sr is not None else None
                )
                if event:
                    await websocket.send_json(event)
            elif msg_type == "commit":
                await websocket.send_json(session.commit())
            elif msg_type == "stop":
                await websocket.send_json(session.stop())
                break
            else:
                await websocket.send_json(
                    {"type": "error", "text": f"unsupported type: {msg_type}"}
                )
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        try:
            await websocket.send_json({"type": "error", "text": str(exc)})
        except Exception:  # noqa: BLE001
            pass
    finally:
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001
            pass

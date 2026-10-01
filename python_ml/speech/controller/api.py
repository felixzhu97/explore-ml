import json
import os
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel

import config
from domain.audio import ALLOWED_AUDIO_SUFFIXES, audio_suffix, is_allowed_audio, new_job_id
from service import speech as service

router = APIRouter()


class VoiceSynthesizeBody(BaseModel):
    text: str
    voice: Optional[str] = None


@router.post("/api/v1/voices:synthesize")
async def voice_synthesize(body: VoiceSynthesizeBody):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    voice = service.default_voice(body.voice)
    job_id = new_job_id()
    out_path = service.voice_path(job_id, config.VOICE_EXT)
    try:
        await service.synthesize_voice(body.text.strip(), voice, out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "audio_url": f"{config.BASE_URL}/output/voice/{job_id}.{config.VOICE_EXT}"
    }


@router.get("/output/voice/{job_id}.mp3")
def serve_voice_mp3(job_id: str):
    path = service.voice_path(job_id, "mp3")
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="audio/mpeg")


@router.get("/output/voice/{job_id}.wav")
def serve_voice_wav(job_id: str):
    path = service.voice_path(job_id, "wav")
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="audio/wav")


@router.post("/api/v1/audios:transcribe")
async def audios_transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe uploaded audio with local Qwen3-ASR (default)."""
    suffix = audio_suffix(file.filename)
    if not is_allowed_audio(suffix):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type {suffix}. Allowed: {', '.join(sorted(ALLOWED_AUDIO_SUFFIXES))}",
        )
    tmp_path = service.upload_path(new_job_id(), suffix)
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
    session = service.new_stream_session()
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

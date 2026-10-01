import json
import os
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel

from speech import config
from speech.domain.audio import ALLOWED_AUDIO_SUFFIXES, audio_suffix, is_allowed_audio, new_job_id
from speech.service.speech import SpeechService, get_speech_service

router = APIRouter()

SpeechServiceDependency = Annotated[SpeechService, Depends(get_speech_service)]


class SynthesizeVoiceRequest(BaseModel):
    text: str
    voice: str | None = None


class SynthesizedVoiceResponse(BaseModel):
    audio_url: str


class TranscriptionResponse(BaseModel):
    text: str
    language: str | None = None


@router.post("/api/v1/voices:synthesize")
async def synthesize_voice(
    request: SynthesizeVoiceRequest, speech_service: SpeechServiceDependency
) -> SynthesizedVoiceResponse:
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    voice = speech_service.default_voice(request.voice)
    job_id = new_job_id()
    output_path = speech_service.voice_path(job_id, config.VOICE_EXTENSION)
    try:
        await speech_service.synthesize_voice(text, voice, output_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    return SynthesizedVoiceResponse(
        audio_url=f"{config.BASE_URL}/output/voice/{job_id}.{config.VOICE_EXTENSION}"
    )


def _voice_file(speech_service: SpeechService, job_id: str, extension: str, media_type: str):
    path = speech_service.voice_path(job_id, extension)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type=media_type)


@router.get("/output/voice/{job_id}.mp3")
def serve_voice_mp3(job_id: str, speech_service: SpeechServiceDependency) -> FileResponse:
    return _voice_file(speech_service, job_id, "mp3", "audio/mpeg")


@router.get("/output/voice/{job_id}.wav")
def serve_voice_wav(job_id: str, speech_service: SpeechServiceDependency) -> FileResponse:
    return _voice_file(speech_service, job_id, "wav", "audio/wav")


@router.post("/api/v1/audios:transcribe", response_model_exclude_none=True)
async def transcribe_audio(
    file: Annotated[UploadFile, File()],
    speech_service: SpeechServiceDependency,
    language: Annotated[str | None, Form()] = None,
) -> TranscriptionResponse:
    """Transcribe uploaded audio with local Qwen3-ASR (default)."""
    suffix = audio_suffix(file.filename)
    if not is_allowed_audio(suffix):
        allowed = ", ".join(sorted(ALLOWED_AUDIO_SUFFIXES))
        raise HTTPException(
            status_code=400, detail=f"Unsupported audio type {suffix}. Allowed: {allowed}"
        )
    upload_path = speech_service.upload_path(new_job_id(), suffix)
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="empty audio file")
        upload_path.write_bytes(audio_bytes)
        result = await speech_service.transcribe_audio(
            str(upload_path), (language or "").strip() or None
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        try:
            if upload_path.exists():
                os.unlink(upload_path)
        except OSError:
            pass
    return TranscriptionResponse(
        text=result.get("text", ""), language=result.get("language") or None
    )


@router.websocket("/ws/v1/audios:transcribe")
async def transcribe_audio_stream(
    websocket: WebSocket, speech_service: SpeechServiceDependency
) -> None:
    """
    Streaming transcription over WebSocket (Qwen3-ASR rolling buffer by default).

    Client → server:
      {"type":"audio","data":"<base64 pcm|wav>","sample_rate":16000}
      {"type":"commit"}
      {"type":"stop"}
    Server → client:
      {"type":"partial"|"final"|"error","text":"..."}
    """
    await websocket.accept()
    session = speech_service.new_stream_session()
    try:
        while True:
            text_frame = await websocket.receive_text()
            try:
                message = json.loads(text_frame)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "text": "invalid JSON"})
                continue
            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "text": "message must be object"})
                continue
            message_type = message.get("type")
            if message_type == "audio":
                audio_payload = message.get("data")
                if not isinstance(audio_payload, str) or not audio_payload.strip():
                    continue
                sample_rate = message.get("sample_rate")
                event = session.append_audio(
                    audio_payload, sample_rate=int(sample_rate) if sample_rate is not None else None
                )
                if event:
                    await websocket.send_json(event)
            elif message_type == "commit":
                await websocket.send_json(session.commit())
            elif message_type == "stop":
                await websocket.send_json(session.stop())
                break
            else:
                await websocket.send_json(
                    {"type": "error", "text": f"unsupported type: {message_type}"}
                )
    except WebSocketDisconnect:
        return
    except Exception as error:  # noqa: BLE001
        try:
            await websocket.send_json({"type": "error", "text": str(error)})
        except Exception:  # noqa: BLE001
            pass
    finally:
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001
            pass

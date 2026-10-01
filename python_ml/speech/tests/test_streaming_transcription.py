import base64
import json

from fastapi.testclient import TestClient

from speech.controller.api import router
from speech.infra.streaming_transcription import StreamingTranscriptionSession, pcm16_le_to_wav_bytes
from server import create_app

app = create_app(["speech"])


def test_should_register_streaming_transcription_websocket_route():
    paths = {getattr(r, "path", None) for r in router.routes}
    assert "/ws/v1/audios:transcribe" in paths


def test_should_emit_partial_then_final_when_audio_committed():
    calls = []

    def fake_transcribe(path: str, language):
        calls.append((path, language))
        return {"text": f"hello-{len(calls)}"}

    session = StreamingTranscriptionSession(
        transcribe=fake_transcribe,
        sample_rate=16000,
        partial_interval_sec=0.0,
        min_partial_bytes=2,
    )
    pcm = b"\x00\x01" * 100
    base64_audio = base64.b64encode(pcm).decode("ascii")

    partial = session.append_audio(base64_audio)
    assert partial is not None
    assert partial["type"] == "partial"
    assert partial["text"].startswith("hello-")

    final = session.commit()
    assert final["type"] == "final"
    assert final["text"].startswith("hello-")
    assert calls, "transcribe should have been called"


def test_should_reject_non_json_on_streaming_transcription_websocket():
    client = TestClient(app)
    with client.websocket_connect("/ws/v1/audios:transcribe") as websocket:
        websocket.send_text("not-json")
        message = websocket.receive_json()
        assert message["type"] == "error"
        assert "invalid JSON" in message["text"]
        websocket.send_text(json.dumps({"type": "stop"}))
        final = websocket.receive_json()
        assert final["type"] == "final"


def test_should_wrap_pcm_as_wav_for_asr_backends():
    pcm = b"\x00\x00" * 16
    wav = pcm16_le_to_wav_bytes(pcm, sample_rate=16000)
    assert wav[:4] == b"RIFF"
    assert b"WAVE" in wav[:12]

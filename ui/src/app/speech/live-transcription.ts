export const TRANSCRIPTION_SAMPLE_RATE = 16000;

const PCM16_BYTES_PER_SAMPLE = 2;
const BASE64_CHUNK_BYTES = 0x8000;
const AUDIO_BUFFER_SIZE = 4096;

/** Float samples in [-1, 1] → little-endian PCM16, base64-encoded. */
export function floatToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * PCM16_BYTES_PER_SAMPLE);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      index * PCM16_BYTES_PER_SAMPLE,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES));
  }
  return btoa(binary);
}

export function transcriptionSocketUrl(location: Pick<Location, 'protocol' | 'host'>): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ml/ws/v1/audios:transcribe`;
}

export interface TranscriptionEvent {
  type: 'partial' | 'final' | 'error';
  text: string;
}

export interface LiveTranscriptionHandlers {
  onEvent: (event: TranscriptionEvent) => void;
  onSamples?: (samples: Float32Array) => void;
}

/** Streams microphone audio to the speech helper's WebSocket transcription endpoint. */
export class LiveTranscription {
  private socket?: WebSocket;
  private audioContext?: AudioContext;
  private microphoneStream?: MediaStream;
  private processor?: ScriptProcessorNode;

  constructor(private readonly handlers: LiveTranscriptionHandlers) {}

  async start(): Promise<void> {
    this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const socket = new WebSocket(transcriptionSocketUrl(window.location));
    this.socket = socket;
    socket.onmessage = (message) =>
      this.handlers.onEvent(JSON.parse(message.data) as TranscriptionEvent);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error('WebSocket 连接失败'));
    });
    this.audioContext = new AudioContext({ sampleRate: TRANSCRIPTION_SAMPLE_RATE });
    const source = this.audioContext.createMediaStreamSource(this.microphoneStream);
    this.processor = this.audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);
    this.processor.onaudioprocess = (audioEvent) => {
      const samples = new Float32Array(audioEvent.inputBuffer.getChannelData(0));
      this.handlers.onSamples?.(samples);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'audio',
            data: floatToPcm16Base64(samples),
            sample_rate: TRANSCRIPTION_SAMPLE_RATE,
          }),
        );
      }
    };
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop(): void {
    this.processor?.disconnect();
    this.microphoneStream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close();
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'stop' }));
    }
  }
}

export const ASR_SAMPLE_RATE = 16000;

/** Float samples in [-1, 1] → little-endian PCM16, base64-encoded. */
export function floatToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function asrSocketUrl(location: Pick<Location, 'protocol' | 'host'>): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/svc/speech/ws/v1/audios:transcribe`;
}

export interface AsrEvent {
  type: 'partial' | 'final' | 'error';
  text: string;
}

export interface LiveAsrHandlers {
  onEvent: (event: AsrEvent) => void;
  onSamples: (samples: Float32Array) => void;
}

/** Streams microphone audio to the speech helper's WebSocket ASR endpoint. */
export class LiveAsr {
  private socket?: WebSocket;
  private ctx?: AudioContext;
  private stream?: MediaStream;
  private processor?: ScriptProcessorNode;

  constructor(private readonly handlers: LiveAsrHandlers) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.socket = new WebSocket(asrSocketUrl(window.location));
    this.socket.onmessage = (msg) => this.handlers.onEvent(JSON.parse(msg.data) as AsrEvent);
    await new Promise<void>((resolve, reject) => {
      this.socket!.onopen = () => resolve();
      this.socket!.onerror = () => reject(new Error('WebSocket 连接失败'));
    });
    this.ctx = new AudioContext({ sampleRate: ASR_SAMPLE_RATE });
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const samples = new Float32Array(e.inputBuffer.getChannelData(0));
      this.handlers.onSamples(samples);
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: 'audio',
            data: floatToPcm16Base64(samples),
            sample_rate: ASR_SAMPLE_RATE,
          }),
        );
      }
    };
    source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
  }

  stop(): void {
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'stop' }));
    }
  }
}

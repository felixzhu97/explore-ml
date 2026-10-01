import { audioEnvelope, type EnvelopeBucket } from './chart-math';

const ENVELOPE_BUCKETS = 600;
const DECODE_SAMPLE_RATE = 44100;

export interface DecodedAudio {
  durationSeconds: number;
  envelope: EnvelopeBucket[];
}

/** Decodes an audio file (first channel) into a waveform envelope without playing it. */
export async function decodeAudio(source: Blob | string): Promise<DecodedAudio> {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  const context = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  return {
    durationSeconds: buffer.duration,
    envelope: audioEnvelope(buffer.getChannelData(0), ENVELOPE_BUCKETS),
  };
}

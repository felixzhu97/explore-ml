export interface Peak {
  min: number;
  max: number;
}

/** Min/max peaks per bucket, used to draw a compact waveform. */
export function computePeaks(samples: Float32Array, buckets: number): Peak[] {
  const n = Math.max(1, Math.min(buckets, samples.length || 1));
  const size = samples.length / n;
  const peaks: Peak[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * size);
    const end = Math.max(start + 1, Math.floor((i + 1) * size));
    let min = 0;
    let max = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      const v = samples[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks.push({ min, max });
  }
  return peaks;
}

/** Appends one peak for a live chunk, keeping at most `limit` peaks. */
export function appendPeak(peaks: readonly Peak[], chunk: Float32Array, limit: number): Peak[] {
  const next = [...peaks, computePeaks(chunk, 1)[0]];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export async function decodeAudio(source: Blob | string): Promise<AudioBuffer> {
  const buffer =
    typeof source === 'string'
      ? await (await fetch(source)).arrayBuffer()
      : await source.arrayBuffer();
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(buffer);
  } finally {
    void ctx.close();
  }
}

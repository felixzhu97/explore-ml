import { asrSocketUrl, floatToPcm16Base64 } from '../core/api/live-asr';
import { appendPeak, computePeaks } from './waveform';

describe('waveform peaks', () => {
  it('should reduce samples to min/max per bucket', () => {
    const peaks = computePeaks(new Float32Array([0.1, -0.5, 0.9, -0.2]), 2);
    expect(peaks[0].min).toBeCloseTo(-0.5);
    expect(peaks[0].max).toBeCloseTo(0.1);
    expect(peaks[1].min).toBeCloseTo(-0.2);
    expect(peaks[1].max).toBeCloseTo(0.9);
  });

  it('should never return more buckets than samples', () => {
    expect(computePeaks(new Float32Array([0.3]), 400)).toHaveLength(1);
  });

  it('should keep a rolling window of live peaks', () => {
    let peaks = appendPeak([], new Float32Array([0.5]), 2);
    peaks = appendPeak(peaks, new Float32Array([-0.5]), 2);
    peaks = appendPeak(peaks, new Float32Array([0.25]), 2);
    expect(peaks).toEqual([
      { min: -0.5, max: 0 },
      { min: 0, max: 0.25 },
    ]);
  });
});

describe('live ASR encoding', () => {
  it('should encode clipped floats as little-endian PCM16', () => {
    const bytes = Uint8Array.from(atob(floatToPcm16Base64(new Float32Array([0, 1, -1, 2]))), (c) =>
      c.charCodeAt(0),
    );
    const view = new DataView(bytes.buffer);
    expect([0, 2, 4, 6].map((o) => view.getInt16(o, true))).toEqual([0, 32767, -32768, 32767]);
  });

  it('should target the proxied websocket with the page scheme', () => {
    expect(asrSocketUrl({ protocol: 'https:', host: 'ui.local' })).toBe(
      'wss://ui.local/svc/speech/ws/v1/audios:transcribe',
    );
    expect(asrSocketUrl({ protocol: 'http:', host: 'localhost:4200' })).toBe(
      'ws://localhost:4200/svc/speech/ws/v1/audios:transcribe',
    );
  });
});

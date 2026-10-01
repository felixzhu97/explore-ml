import * as d3 from 'd3';

export interface Point {
  x: number;
  y: number;
}

export interface Series {
  label: string;
  points: Point[];
}

export interface Bin {
  x0: number;
  x1: number;
  count: number;
}

/** Equal-width bins over `[min, max]` of the values (d3.bin "nice" thresholds). */
export function scoreBins(values: readonly number[], binCount = 10): Bin[] {
  if (!values.length) return [];
  const [min, max] = d3.extent(values) as [number, number];
  const domain: [number, number] = min === max ? [min - 0.5, max + 0.5] : [min, max];
  return d3
    .bin()
    .domain(domain)
    .thresholds(binCount)(values)
    .map((bin) => ({ x0: bin.x0 ?? domain[0], x1: bin.x1 ?? domain[1], count: bin.length }));
}

export interface RankShift {
  id: string;
  from: number;
  to: number | null;
  score: number | null;
}

/** Input position versus ranked position per candidate; `to` is null when the ranker dropped it. */
export function rankShifts(
  candidates: readonly string[],
  ranked: readonly { id: string; score: number }[],
): RankShift[] {
  const rankById = new Map(ranked.map((item, index) => [item.id, { index, score: item.score }]));
  const seen = new Set<string>();
  return candidates
    .filter((id) => !seen.has(id) && seen.add(id))
    .map((id, from) => {
      const result = rankById.get(id);
      return { id, from, to: result?.index ?? null, score: result?.score ?? null };
    });
}

/** Appends one sample per series, keeping at most `capacity` points each. */
export function appendSamples(
  history: readonly Series[],
  x: number,
  samples: Record<string, number | null>,
  capacity: number,
): Series[] {
  const byLabel = new Map(history.map((series) => [series.label, series.points]));
  return Object.entries(samples).map(([label, y]) => {
    const points = byLabel.get(label) ?? [];
    const next = y === null ? points : [...points, { x, y }];
    return { label, points: next.slice(-capacity) };
  });
}

export interface ScoredFrame {
  offset_seconds: number;
  scores: Record<string, number>;
}

/** One series per category over frame offsets, in first-seen category order. */
export function frameSeries(frames: readonly ScoredFrame[]): Series[] {
  const byLabel = new Map<string, Point[]>();
  for (const frame of frames) {
    for (const [label, score] of Object.entries(frame.scores)) {
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label)!.push({ x: frame.offset_seconds, y: score });
    }
  }
  return [...byLabel].map(([label, points]) => ({ label, points }));
}

/** Frame scores that reach their category threshold. */
export function flaggedPoints(
  frames: readonly ScoredFrame[],
  thresholds: Record<string, number>,
): Point[] {
  return frames.flatMap((frame) =>
    Object.entries(frame.scores)
      .filter(([label, score]) => label in thresholds && score >= thresholds[label])
      .map(([, score]) => ({ x: frame.offset_seconds, y: score })),
  );
}

export interface Projection {
  coordinates: [number, number][];
  /** Share of total variance captured by each of the two components. */
  explained: [number, number];
}

const PCA_ITERATIONS = 60;

/** Top-two principal components by power iteration with deflation (deterministic start). */
export function pca2(vectors: readonly (readonly number[])[]): Projection {
  const count = vectors.length;
  const dimension = vectors[0]?.length ?? 0;
  if (!count || !dimension) return { coordinates: [], explained: [0, 0] };
  const mean = new Float64Array(dimension);
  for (const vector of vectors) {
    for (let index = 0; index < dimension; index++) mean[index] += vector[index] / count;
  }
  const centered = vectors.map((vector) =>
    Float64Array.from(vector, (value, index) => value - mean[index]),
  );
  const totalVariance = centered.reduce((total, row) => total + dot(row, row), 0);
  const components: Float64Array[] = [];
  const variances: number[] = [];
  for (let component = 0; component < 2; component++) {
    let axis = Float64Array.from(
      { length: dimension },
      (_, index) => 1 + ((index * 7 + component) % 5),
    );
    let variance = 0;
    for (let iteration = 0; iteration < PCA_ITERATIONS; iteration++) {
      for (const previous of components) subtractProjection(axis, previous);
      const norm = Math.sqrt(dot(axis, axis));
      if (norm === 0) break;
      axis = axis.map((value) => value / norm);
      const next = new Float64Array(dimension);
      variance = 0;
      for (const row of centered) {
        const projection = dot(row, axis);
        variance += projection * projection;
        for (let index = 0; index < dimension; index++) next[index] += row[index] * projection;
      }
      axis = next;
    }
    for (const previous of components) subtractProjection(axis, previous);
    const norm = Math.sqrt(dot(axis, axis));
    components.push(norm === 0 ? new Float64Array(dimension) : axis.map((value) => value / norm));
    variances.push(variance);
  }
  return {
    coordinates: centered.map((row) => [dot(row, components[0]), dot(row, components[1])]),
    explained: totalVariance
      ? [variances[0] / totalVariance, variances[1] / totalVariance]
      : [0, 0],
  };
}

function dot(left: ArrayLike<number>, right: ArrayLike<number>): number {
  let total = 0;
  for (let index = 0; index < left.length; index++) total += left[index] * right[index];
  return total;
}

function subtractProjection(axis: Float64Array, unit: Float64Array): void {
  const projection = dot(axis, unit);
  for (let index = 0; index < axis.length; index++) axis[index] -= projection * unit[index];
}

/** Human label for a RAG chunk: title, file name, URL or document id. */
export function sourceLabel(metadata: Record<string, unknown> | undefined): string {
  for (const key of ['title', 'filename', 'url', 'doc_id', 'source_type']) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '未知来源';
}

export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** Distinct keys with counts, most frequent first. */
export function groupCounts(keys: readonly string[]): { key: string; count: number }[] {
  return d3
    .rollups(
      keys,
      (group) => group.length,
      (key) => key,
    )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export interface StatusEvent {
  at: number;
  status: string;
}

export interface StatusSegment {
  status: string;
  start: number;
  end: number;
}

/** Collapses consecutive identical statuses into spans; the last span runs until `endAt`. */
export function statusSegments(events: readonly StatusEvent[], endAt: number): StatusSegment[] {
  const segments: StatusSegment[] = [];
  for (const event of events) {
    const last = segments.at(-1);
    if (last?.status === event.status) continue;
    if (last) last.end = event.at;
    segments.push({ status: event.status, start: event.at, end: event.at });
  }
  const last = segments.at(-1);
  if (last) last.end = Math.max(last.start, endAt);
  return segments;
}

/** Share of pixels per intensity bin for the R, G and B channels of RGBA pixel data. */
export function channelHistogram(rgba: ArrayLike<number>, binCount = 32): Series[] {
  const counts = [0, 1, 2].map(() => new Array<number>(binCount).fill(0));
  const pixels = Math.floor(rgba.length / 4);
  for (let offset = 0; offset < pixels * 4; offset += 4) {
    for (let channel = 0; channel < 3; channel++) {
      counts[channel][
        Math.min(binCount - 1, Math.floor((rgba[offset + channel] * binCount) / 256))
      ]++;
    }
  }
  const binWidth = 256 / binCount;
  return ['R', 'G', 'B'].map((label, channel) => ({
    label,
    points: counts[channel].map((count, bin) => ({
      x: bin * binWidth + binWidth / 2,
      y: pixels ? count / pixels : 0,
    })),
  }));
}

export interface EnvelopeBucket {
  min: number;
  max: number;
}

/** Min and max sample per bucket, for drawing a waveform at a fixed width. */
export function audioEnvelope(samples: ArrayLike<number>, bucketCount: number): EnvelopeBucket[] {
  if (!samples.length || bucketCount <= 0) return [];
  const size = samples.length / bucketCount;
  return Array.from({ length: Math.min(bucketCount, samples.length) }, (_, bucket) => {
    const start = Math.floor(bucket * size);
    const end = Math.max(start + 1, Math.floor((bucket + 1) * size));
    let min = Infinity;
    let max = -Infinity;
    for (let index = start; index < end && index < samples.length; index++) {
      min = Math.min(min, samples[index]);
      max = Math.max(max, samples[index]);
    }
    return { min, max };
  });
}

/** Root mean square of the samples (0 for silence, 1 for a full-scale square wave). */
export function rms(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let total = 0;
  for (let index = 0; index < samples.length; index++) total += samples[index] * samples[index];
  return Math.sqrt(total / samples.length);
}

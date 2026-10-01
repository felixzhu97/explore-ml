import { postJson } from './http';
import { svcUrl } from './services';

export const MAX_BROWSER_POINTS = 2000;

/** Token colors only: primary, primary-on-dark, muted ink, ink. */
export const CATEGORY_COLORS = ['#0066cc', '#2997ff', '#7a7a7a', '#1d1d1f'];

export interface AtlasPoint {
  id: string;
  vector: number[];
  text: string;
  metadata: Record<string, unknown>;
}

export interface ExportedVectors {
  dimension: number;
  points: AtlasPoint[];
}

export function exportVectors(collection?: string, limit = 10000) {
  return postJson<ExportedVectors>(svcUrl('rag', '/api/v1/documents:exportVectors'), {
    collection: collection || undefined,
    limit,
  });
}

export function collectionOf(point: AtlasPoint): string {
  return String(point.metadata['collection'] ?? 'unknown');
}

/** Deterministic sample (seeded Fisher–Yates) so reloads keep the same layout. */
export function samplePoints<T>(
  points: readonly T[],
  max = MAX_BROWSER_POINTS,
  seed = 42,
): { points: T[]; sampled: boolean } {
  if (points.length <= max) return { points: [...points], sampled: false };
  const copy = [...points];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return { points: copy.slice(0, max), sampled: true };
}

export function toMatrix(points: readonly AtlasPoint[], dimension: number): Float32Array {
  const data = new Float32Array(points.length * dimension);
  points.forEach((p, i) => data.set(p.vector.slice(0, dimension), i * dimension));
  return data;
}

export function categorize(points: readonly AtlasPoint[]): {
  names: string[];
  codes: Uint8Array<ArrayBuffer>;
} {
  const names: string[] = [];
  const codes = new Uint8Array(points.length);
  points.forEach((p, i) => {
    const name = collectionOf(p);
    let code = names.indexOf(name);
    if (code === -1) code = names.push(name) - 1;
    codes[i] = Math.min(code, 255);
  });
  return { names, codes };
}

export function splitXY(embedding: Float32Array, count: number) {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    x[i] = embedding[i * 2];
    y[i] = embedding[i * 2 + 1];
  }
  return { x, y };
}

export interface Rect {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export function pointsInRects(x: Float32Array, y: Float32Array, rects: readonly Rect[]): number[] {
  const hits: number[] = [];
  for (let i = 0; i < x.length; i++) {
    if (rects.some((r) => x[i] >= r.xMin && x[i] <= r.xMax && y[i] >= r.yMin && y[i] <= r.yMax)) {
      hits.push(i);
    }
  }
  return hits;
}

const STOP_WORDS = new Set(
  'the a an and or of to in on for with is are was were be by as at it this that from you your we our can will not but have has'.split(
    ' ',
  ),
);

/** Picks the most frequent non-stop-word terms as a cluster label. */
export function keywordLabel(texts: readonly string[], terms = 2): string | null {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const words = new Set(text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []);
    for (const w of words) {
      if (!STOP_WORDS.has(w) && !/^\d+$/.test(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, terms)
    .map(([w]) => w);
  return top.length ? top.join(' · ') : null;
}

/** Nearest point index to (px, py) within `maxDistance`, or -1. */
export function nearestPoint(
  x: Float32Array,
  y: Float32Array,
  px: number,
  py: number,
  maxDistance: number,
): number {
  let best = -1;
  let bestDist = maxDistance * maxDistance;
  for (let i = 0; i < x.length; i++) {
    const d = (x[i] - px) ** 2 + (y[i] - py) ** 2;
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

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

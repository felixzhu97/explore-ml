import * as d3 from 'd3';

export interface BarDatum {
  label: string;
  value: number | null;
}

export const CHART_COLORS = {
  primary: '#0066cc',
  secondary: '#7a7a7a',
  empty: '#e0e0e0',
  ink: '#1d1d1f',
} as const;

export function horizontalBarScales(
  data: readonly BarDatum[],
  width: number,
  rowHeight: number,
  max?: number,
) {
  const domainMax = max ?? (d3.max(data, (d) => d.value ?? 0) || 1);
  const x = d3.scaleLinear().domain([0, domainMax]).range([0, width]).nice();
  const y = d3
    .scaleBand<string>()
    .domain(data.map((d) => d.label))
    .range([0, data.length * rowHeight])
    .padding(0.3);
  return { x, y };
}

export interface GroupedSeries {
  key: string;
  color: string;
}

export function groupedBarScales(
  groups: readonly string[],
  series: readonly GroupedSeries[],
  width: number,
  height: number,
  max: number,
) {
  const x0 = d3.scaleBand<string>().domain(groups).range([0, width]).padding(0.25);
  const x1 = d3
    .scaleBand<string>()
    .domain(series.map((s) => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.08);
  const y = d3
    .scaleLinear()
    .domain([0, max || 1])
    .range([height, 0])
    .nice();
  return { x0, x1, y };
}

/** Sequential single-hue scale (canvas → primary) for heatmaps. */
export function heatScale(max: number) {
  return d3
    .scaleSequential(d3.interpolateRgb('#ffffff', CHART_COLORS.primary))
    .domain([0, max || 1]);
}

export function textOn(fill: string): string {
  const c = d3.lab(fill);
  return c.l > 60 ? CHART_COLORS.ink : '#ffffff';
}

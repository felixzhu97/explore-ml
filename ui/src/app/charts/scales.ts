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

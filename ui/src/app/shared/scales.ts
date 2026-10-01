import * as d3 from 'd3';

export interface BarDatum {
  label: string;
  value: number | null;
}

export const CHART_COLORS = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-muted)',
  empty: 'var(--color-hairline)',
  ink: 'var(--color-ink)',
} as const;

export function horizontalBarScales(
  data: readonly BarDatum[],
  width: number,
  rowHeight: number,
  max?: number,
) {
  const domainMax = max ?? (d3.max(data, (datum) => datum.value ?? 0) || 1);
  const xScale = d3.scaleLinear().domain([0, domainMax]).range([0, width]).nice();
  const yScale = d3
    .scaleBand<string>()
    .domain(data.map((datum) => datum.label))
    .range([0, data.length * rowHeight])
    .padding(0.3);
  return { xScale, yScale };
}

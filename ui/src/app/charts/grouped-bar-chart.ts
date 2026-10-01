import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  viewChild,
} from '@angular/core';
import * as d3 from 'd3';
import type { GroupedData } from '../core/eval-report';
import { observeHostWidth } from './observe-width';
import { SERIES_COLORS, groupedBarScales } from './scales';

const HEIGHT = 260;
const MARGIN = { top: 24, right: 8, bottom: 28, left: 44 };

interface Cell {
  group: string;
  series: string;
  value: number;
}

/** Grouped vertical bars (metrics × models) rendered with d3. */
@Component({
  selector: 'app-grouped-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'chart' },
  template: `
    <svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>
    <ul class="legend">
      @for (s of legend(); track s.name) {
        <li><span class="swatch" [style.background]="s.color"></span>{{ s.name }}</li>
      }
      @if (lowerIsBetter()) {
        <li class="direction">↓ 越低越好</li>
      }
    </ul>
  `,
  styles: `
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      list-style: none;
      margin: var(--space-xs) 0 0;
      padding: 0;
      font-size: 14px;
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      margin-right: var(--space-xxs);
    }
    .direction {
      font-weight: 600;
    }
  `,
})
export class GroupedBarChart {
  readonly data = input.required<GroupedData>();
  readonly lowerIsBetter = input(false);
  readonly max = input<number>();
  readonly ariaLabel = input.required<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();
  protected readonly legend = computed(() =>
    this.data().series.map((name, i) => ({ name, color: SERIES_COLORS[i % SERIES_COLORS.length] })),
  );

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const { groups, series, values } = this.data();
    const width = this.width();
    const innerW = Math.max(120, width - MARGIN.left - MARGIN.right);
    const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
    const max = this.max() ?? (d3.max(values.flat(), (v) => v ?? 0) || 1);
    const { x0, x1, y } = groupedBarScales(
      groups,
      series.map((key, i) => ({ key, color: SERIES_COLORS[i % SERIES_COLORS.length] })),
      innerW,
      innerH,
      max,
    );
    const color = d3.scaleOrdinal<string, string>().domain(series).range(SERIES_COLORS);
    const fmt = d3.format('.3~f');

    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', HEIGHT);
    const plot = root
      .selectAll<SVGGElement, null>('g.plot')
      .data([null])
      .join('g')
      .attr('class', 'plot')
      .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`);

    plot
      .selectAll<SVGGElement, null>('g.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));
    plot
      .selectAll<SVGGElement, null>('g.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${innerH})`)
      .call(d3.axisBottom(x0).tickSizeOuter(0));

    const cells: Cell[] = groups.flatMap((group, g) =>
      series.flatMap((s, i) =>
        values[g][i] == null ? [] : [{ group, series: s, value: values[g][i]! }],
      ),
    );
    const bars = plot
      .selectAll<SVGGElement, Cell>('g.bar')
      .data(cells, (d) => `${d.group}|${d.series}`)
      .join((enter) => {
        const b = enter.append('g').attr('class', 'bar');
        b.append('rect').attr('rx', 3);
        b.append('text').attr('text-anchor', 'middle');
        return b;
      });
    bars.attr('transform', (d) => `translate(${(x0(d.group) ?? 0) + (x1(d.series) ?? 0)}, 0)`);
    bars
      .select('rect')
      .attr('width', x1.bandwidth())
      .attr('y', (d) => y(d.value))
      .attr('height', (d) => innerH - y(d.value))
      .attr('fill', (d) => color(d.series));
    bars
      .select('text')
      .attr('x', x1.bandwidth() / 2)
      .attr('y', (d) => y(d.value) - 6)
      .text((d) => fmt(d.value));
  }
}

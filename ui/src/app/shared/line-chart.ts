import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import * as d3 from 'd3';
import type { Point, Series } from './chart-math';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS } from './scales';

export interface Rule {
  value: number;
  label: string;
}

const FULL_MARGIN = { top: 16, right: 16, bottom: 28, left: 44 };
const COMPACT_MARGIN = { top: 4, right: 2, bottom: 4, left: 2 };
const DASHES = ['', '6 3', '2 3', '8 3 2 3'];

/**
 * Line chart over a numeric x axis: the first series is drawn in the accent colour, the rest in
 * grey with distinct dash patterns. `thresholds` are horizontal rules, `markers` vertical ones.
 */
@Component({
  selector: 'app-line-chart',
  host: { class: 'block w-full text-fine [&_text]:fill-ink-80' },
  template: `
    <svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>
    @if (!compact() && series().length > 1) {
      <ul class="m-0 flex list-none flex-wrap gap-4 p-0 text-fine text-muted">
        @for (item of series(); track item.label; let index = $index) {
          <li class="flex items-center gap-1">
            <svg width="20" height="8" aria-hidden="true">
              <line
                x1="0"
                x2="20"
                y1="4"
                y2="4"
                stroke-width="2"
                [attr.stroke]="index === 0 ? colors.primary : colors.secondary"
                [attr.stroke-dasharray]="dash(index)"
              />
            </svg>
            {{ item.label }}
          </li>
        }
      </ul>
    }
  `,
})
export class LineChart {
  readonly series = input.required<Series[]>();
  readonly thresholds = input<Rule[]>([]);
  readonly markers = input<Rule[]>([]);
  readonly highlights = input<Point[]>([]);
  readonly xMin = input<number>();
  readonly yMax = input<number>();
  readonly height = input(200);
  readonly compact = input(false);
  readonly curve = input<'linear' | 'step'>('linear');
  readonly xFormat = input<(value: number) => string>(d3.format('~s'));
  readonly yFormat = input<(value: number) => string>(d3.format('~s'));
  readonly ariaLabel = input.required<string>();

  protected readonly colors = CHART_COLORS;
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();

  constructor() {
    afterRenderEffect(() => this.render());
  }

  protected dash(index: number): string {
    return DASHES[index % DASHES.length];
  }

  private render(): void {
    const series = this.series();
    const thresholds = this.thresholds();
    const markers = this.markers();
    const compact = this.compact();
    const width = this.width();
    const height = this.height();
    const margin = compact ? COMPACT_MARGIN : FULL_MARGIN;
    const innerWidth = Math.max(40, width - margin.left - margin.right);
    const innerHeight = Math.max(20, height - margin.top - margin.bottom);
    const points = series.flatMap((item) => item.points);

    const [dataXMin = 0, xMax = 1] = d3.extent(points, (point) => point.x);
    const xMin = this.xMin() ?? dataXMin;
    const xScale = d3
      .scaleLinear()
      .domain(xMin === xMax ? [xMin, xMin + 1] : [xMin, xMax])
      .range([0, innerWidth]);
    const yTop =
      this.yMax() ??
      Math.max(
        d3.max(points, (point) => point.y) ?? 0,
        d3.max(thresholds, (rule) => rule.value) ?? 0,
      );
    const yScale = d3
      .scaleLinear()
      .domain([0, yTop || 1])
      .range([innerHeight, 0])
      .nice();

    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', height);
    const plot = root
      .selectAll<SVGGElement, null>('g.plot')
      .data([null])
      .join('g')
      .attr('class', 'plot')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    plot
      .selectAll<SVGGElement, null>('g.x-axis')
      .data(compact ? [] : [null])
      .join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(Math.max(2, Math.floor(innerWidth / 80)))
          .tickFormat((value) => this.xFormat()(+value)),
      );
    plot
      .selectAll<SVGGElement, null>('g.y-axis')
      .data(compact ? [] : [null])
      .join('g')
      .attr('class', 'y-axis')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickFormat((value) => this.yFormat()(+value)),
      );
    plot.selectAll('.domain, .tick line').style('stroke', CHART_COLORS.empty);

    const line = d3
      .line<Point>()
      .x((point) => xScale(point.x))
      .y((point) => yScale(point.y))
      .curve(this.curve() === 'step' ? d3.curveStepAfter : d3.curveMonotoneX);
    plot
      .selectAll<SVGPathElement, Series>('path.series')
      .data(series, (item) => item.label)
      .join('path')
      .attr('class', 'series')
      .attr('fill', 'none')
      .attr('stroke-width', compact ? 1.5 : 2)
      .style('stroke', (_, index) => (index === 0 ? CHART_COLORS.primary : CHART_COLORS.secondary))
      .attr('stroke-dasharray', (_, index) => this.dash(index))
      .attr('d', (item) => line(item.points));

    plot
      .selectAll<SVGCircleElement, Point>('circle.highlight')
      .data(this.highlights())
      .join('circle')
      .attr('class', 'highlight')
      .attr('r', 4)
      .attr('cx', (point) => xScale(point.x))
      .attr('cy', (point) => yScale(point.y))
      .style('fill', CHART_COLORS.primary);

    this.rules(plot, 'threshold', thresholds, (rule) => ({
      x1: 0,
      x2: innerWidth,
      y1: yScale(rule.value),
      y2: yScale(rule.value),
      textX: innerWidth,
      textY: yScale(rule.value) - 4,
      anchor: 'end',
    }));
    this.rules(plot, 'marker', markers, (rule) => ({
      x1: xScale(rule.value),
      x2: xScale(rule.value),
      y1: 0,
      y2: innerHeight,
      textX: xScale(rule.value) + (xScale(rule.value) > innerWidth * 0.8 ? -4 : 4),
      textY: 10,
      anchor: xScale(rule.value) > innerWidth * 0.8 ? 'end' : 'start',
    }));
  }

  private rules(
    plot: d3.Selection<SVGGElement, null, SVGSVGElement, unknown>,
    kind: string,
    rules: Rule[],
    geometry: (rule: Rule) => {
      x1: number;
      x2: number;
      y1: number;
      y2: number;
      textX: number;
      textY: number;
      anchor: string;
    },
  ): void {
    const groups = plot
      .selectAll<SVGGElement, Rule>(`g.${kind}`)
      .data(this.compact() ? [] : rules)
      .join((enter) => {
        const group = enter.append('g').attr('class', kind);
        group.append('line').style('stroke', CHART_COLORS.ink).attr('stroke-dasharray', '3 3');
        group.append('text');
        return group;
      });
    groups.each(function (rule) {
      const shape = geometry(rule);
      const group = d3.select(this);
      group
        .select('line')
        .attr('x1', shape.x1)
        .attr('x2', shape.x2)
        .attr('y1', shape.y1)
        .attr('y2', shape.y2);
      group
        .select('text')
        .attr('x', shape.textX)
        .attr('y', shape.textY)
        .attr('text-anchor', shape.anchor)
        .text(rule.label);
    });
  }
}

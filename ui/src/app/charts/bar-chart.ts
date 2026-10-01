import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  viewChild,
} from '@angular/core';
import * as d3 from 'd3';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS, horizontalBarScales, type BarDatum } from './scales';

const LABEL_WIDTH = 120;
const VALUE_WIDTH = 72;
const ROW_HEIGHT = 32;

/** Horizontal bar chart rendered with d3 (scores, probabilities, latency). */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full text-xs [&_text]:fill-ink-80' },
  template: `<svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>`,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly max = input<number>();
  readonly format = input<(v: number) => string>(d3.format('.3~f'));
  readonly emptyLabel = input('—');
  readonly threshold = input<{ value: number; label: string }>();
  readonly ariaLabel = input.required<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const data = this.data();
    const width = this.width();
    const format = this.format();
    const emptyLabel = this.emptyLabel();
    const innerWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
    const { x, y } = horizontalBarScales(data, innerWidth, ROW_HEIGHT, this.max());
    const threshold = this.threshold();
    const top = threshold ? 20 : 0;
    const root = d3
      .select(this.svg().nativeElement)
      .attr('width', width)
      .attr('height', data.length * ROW_HEIGHT + top);
    const plot = root
      .selectAll<SVGGElement, number>('g.plot')
      .data([top])
      .join('g')
      .attr('class', 'plot')
      .attr('transform', (t) => `translate(0, ${t})`);

    const rows = plot
      .selectAll<SVGGElement, BarDatum>('g.row')
      .data(data, (d) => d.label)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'row');
        g.append('text').attr('class', 'label').attr('dominant-baseline', 'middle');
        g.append('rect').attr('class', 'track').attr('rx', 4);
        g.append('rect').attr('class', 'bar').attr('rx', 4);
        g.append('text').attr('class', 'value').attr('dominant-baseline', 'middle');
        return g;
      });

    rows.attr('transform', (d) => `translate(0, ${y(d.label) ?? 0})`);
    rows
      .select('text.label')
      .attr('y', y.bandwidth() / 2)
      .text((d) => d.label);
    rows
      .select('rect.track')
      .attr('x', LABEL_WIDTH)
      .attr('width', innerWidth)
      .attr('height', y.bandwidth())
      .attr('fill', CHART_COLORS.empty)
      .attr('opacity', 0.4);
    rows
      .select<SVGRectElement>('rect.bar')
      .attr('x', LABEL_WIDTH)
      .attr('height', y.bandwidth())
      .attr('fill', CHART_COLORS.primary)
      .transition()
      .duration(300)
      .attr('width', (d) => (d.value == null ? 0 : Math.max(0, x(d.value))));
    rows
      .select('text.value')
      .attr('x', LABEL_WIDTH + innerWidth + 8)
      .attr('y', y.bandwidth() / 2)
      .text((d) => (d.value == null ? emptyLabel : format(d.value)));

    const rule = root
      .selectAll<SVGGElement, { value: number; label: string }>('g.threshold')
      .data(threshold ? [threshold] : [])
      .join((enter) => {
        const g = enter.append('g').attr('class', 'threshold');
        g.append('line').attr('stroke', CHART_COLORS.ink).attr('stroke-dasharray', '3 3');
        g.append('text').attr('text-anchor', 'middle');
        return g;
      });
    rule.attr('transform', (t) => `translate(${LABEL_WIDTH + x(t.value)}, 0)`);
    rule
      .select('line')
      .attr('y1', 14)
      .attr('y2', top + data.length * ROW_HEIGHT);
    rule
      .select('text')
      .attr('y', 10)
      .text((t) => t.label);
  }
}

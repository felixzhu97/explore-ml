import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS, horizontalBarScales, type BarDatum } from './scales';

const LABEL_WIDTH = 120;
const VALUE_WIDTH = 72;
const ROW_HEIGHT = 32;

/** Horizontal bar chart rendered with d3 (scores, probabilities, latency). */
@Component({
  selector: 'app-bar-chart',
  host: { class: 'block w-full text-fine [&_text]:fill-ink-80' },
  template: `<svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>`,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly max = input<number>();
  readonly format = input<(value: number) => string>(d3.format('.3~f'));
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
    const { xScale, yScale } = horizontalBarScales(data, innerWidth, ROW_HEIGHT, this.max());
    const threshold = this.threshold();
    const thresholdHeight = threshold ? 20 : 0;
    const root = d3
      .select(this.svg().nativeElement)
      .attr('width', width)
      .attr('height', data.length * ROW_HEIGHT + thresholdHeight);
    const plot = root
      .selectAll<SVGGElement, number>('g.plot')
      .data([thresholdHeight])
      .join('g')
      .attr('class', 'plot')
      .attr('transform', (offset) => `translate(0, ${offset})`);

    const rows = plot
      .selectAll<SVGGElement, BarDatum>('g.row')
      .data(data, (datum) => datum.label)
      .join((enter) => {
        const row = enter.append('g').attr('class', 'row');
        row.append('text').attr('class', 'label').attr('dominant-baseline', 'middle');
        row.append('rect').attr('class', 'track').attr('rx', 4);
        row.append('rect').attr('class', 'bar').attr('rx', 4);
        row.append('text').attr('class', 'value').attr('dominant-baseline', 'middle');
        return row;
      });

    rows.attr('transform', (datum) => `translate(0, ${yScale(datum.label) ?? 0})`);
    rows
      .select('text.label')
      .attr('y', yScale.bandwidth() / 2)
      .text((datum) => datum.label);
    rows
      .select('rect.track')
      .attr('x', LABEL_WIDTH)
      .attr('width', innerWidth)
      .attr('height', yScale.bandwidth())
      .style('fill', CHART_COLORS.empty)
      .attr('opacity', 0.4);
    rows
      .select<SVGRectElement>('rect.bar')
      .attr('x', LABEL_WIDTH)
      .attr('height', yScale.bandwidth())
      .style('fill', CHART_COLORS.primary)
      .transition()
      .duration(300)
      .attr('width', (datum) => (datum.value == null ? 0 : Math.max(0, xScale(datum.value))));
    rows
      .select('text.value')
      .attr('x', LABEL_WIDTH + innerWidth + 8)
      .attr('y', yScale.bandwidth() / 2)
      .text((datum) => (datum.value == null ? emptyLabel : format(datum.value)));

    const thresholdRule = root
      .selectAll<SVGGElement, { value: number; label: string }>('g.threshold')
      .data(threshold ? [threshold] : [])
      .join((enter) => {
        const rule = enter.append('g').attr('class', 'threshold');
        rule.append('line').style('stroke', CHART_COLORS.ink).attr('stroke-dasharray', '3 3');
        rule.append('text').attr('text-anchor', 'middle');
        return rule;
      });
    thresholdRule.attr('transform', (rule) => `translate(${LABEL_WIDTH + xScale(rule.value)}, 0)`);
    thresholdRule
      .select('line')
      .attr('y1', 14)
      .attr('y2', thresholdHeight + data.length * ROW_HEIGHT);
    thresholdRule
      .select('text')
      .attr('y', 10)
      .text((rule) => rule.label);
  }
}

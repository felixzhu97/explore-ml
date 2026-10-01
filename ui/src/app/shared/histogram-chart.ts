import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import * as d3 from 'd3';
import type { Bin } from './chart-math';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS } from './scales';

const MARGIN = { top: 8, right: 12, bottom: 28, left: 36 };

/** Distribution of values as adjacent bars (output of `scoreBins`). */
@Component({
  selector: 'app-histogram-chart',
  host: { class: 'block w-full text-fine [&_text]:fill-ink-80' },
  template: `<svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>`,
})
export class HistogramChart {
  readonly bins = input.required<Bin[]>();
  readonly height = input(160);
  readonly xFormat = input<(value: number) => string>(d3.format('.2~f'));
  readonly ariaLabel = input.required<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const bins = this.bins();
    const width = this.width();
    const height = this.height();
    const innerWidth = Math.max(40, width - MARGIN.left - MARGIN.right);
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const xScale = d3
      .scaleLinear()
      .domain([bins[0]?.x0 ?? 0, bins.at(-1)?.x1 ?? 1])
      .range([0, innerWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (bin) => bin.count) || 1])
      .range([innerHeight, 0])
      .nice();

    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', height);
    const plot = root
      .selectAll<SVGGElement, null>('g.plot')
      .data([null])
      .join('g')
      .attr('class', 'plot')
      .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`);
    plot
      .selectAll<SVGGElement, null>('g.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(Math.max(2, Math.floor(innerWidth / 70)))
          .tickFormat((value) => this.xFormat()(+value)),
      );
    plot
      .selectAll<SVGGElement, null>('g.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).ticks(3).tickFormat(d3.format('d')));
    plot.selectAll('.domain, .tick line').style('stroke', CHART_COLORS.empty);

    plot
      .selectAll<SVGRectElement, Bin>('rect.bin')
      .data(bins)
      .join('rect')
      .attr('class', 'bin')
      .attr('rx', 2)
      .attr('x', (bin) => xScale(bin.x0) + 1)
      .attr('width', (bin) => Math.max(0, xScale(bin.x1) - xScale(bin.x0) - 2))
      .style('fill', CHART_COLORS.primary)
      .transition()
      .duration(300)
      .attr('y', (bin) => yScale(bin.count))
      .attr('height', (bin) => innerHeight - yScale(bin.count));
  }
}

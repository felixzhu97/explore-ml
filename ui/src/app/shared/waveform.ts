import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import * as d3 from 'd3';
import type { EnvelopeBucket } from './chart-math';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS } from './scales';

/** Audio waveform drawn as the min/max envelope around a zero line. */
@Component({
  selector: 'app-waveform',
  host: { class: 'block w-full' },
  template: `<svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>`,
})
export class Waveform {
  readonly envelope = input.required<EnvelopeBucket[]>();
  readonly height = input(72);
  readonly ariaLabel = input.required<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const envelope = this.envelope();
    const width = this.width();
    const height = this.height();
    const peak =
      d3.max(envelope, (bucket) => Math.max(Math.abs(bucket.min), Math.abs(bucket.max))) || 1;
    const xScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, envelope.length - 1)])
      .range([0, width]);
    const yScale = d3
      .scaleLinear()
      .domain([-peak, peak])
      .range([height - 1, 1]);
    const area = d3
      .area<EnvelopeBucket>()
      .x((_, index) => xScale(index))
      .y0((bucket) => yScale(bucket.min))
      .y1((bucket) => yScale(bucket.max));

    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', height);
    root
      .selectAll<SVGLineElement, null>('line.zero')
      .data([null])
      .join('line')
      .attr('class', 'zero')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', height / 2)
      .attr('y2', height / 2)
      .style('stroke', CHART_COLORS.empty);
    root
      .selectAll<SVGPathElement, EnvelopeBucket[]>('path.wave')
      .data([envelope])
      .join('path')
      .attr('class', 'wave')
      .style('fill', CHART_COLORS.primary)
      .attr('d', area);
  }
}

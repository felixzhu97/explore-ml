import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import * as d3 from 'd3';
import type { StatusSegment } from './chart-math';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS } from './scales';

const HEIGHT = 64;
const BAR_TOP = 8;
const BAR_HEIGHT = 24;
const MARGIN_X = 8;

const STATUS_LABELS: Record<string, string> = {
  submitted: '提交',
  pending: '排队',
  running: '生成中',
  succeeded: '完成',
  failed: '失败',
};

/** Async job lifecycle: one span per status over elapsed time, with a tick per poll. */
@Component({
  selector: 'app-job-timeline',
  host: { class: 'block w-full text-fine [&_text]:fill-ink-80' },
  template: `<svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>`,
})
export class JobTimeline {
  readonly segments = input.required<StatusSegment[]>();
  readonly polls = input<number[]>([]);
  readonly ariaLabel = input.required<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const segments = this.segments();
    const width = this.width();
    const end = d3.max(segments, (segment) => segment.end) || 1;
    const xScale = d3
      .scaleLinear()
      .domain([0, end])
      .range([MARGIN_X, width - MARGIN_X]);
    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', HEIGHT);

    const spans = root
      .selectAll<SVGGElement, StatusSegment>('g.span')
      .data(segments, (segment) => `${segment.status}-${segment.start}`)
      .join((enter) => {
        const group = enter.append('g').attr('class', 'span');
        group.append('rect').attr('rx', 4);
        group.append('text').attr('dominant-baseline', 'middle');
        return group;
      });
    spans
      .select('rect')
      .attr('x', (segment) => xScale(segment.start))
      .attr('y', BAR_TOP)
      .attr('height', BAR_HEIGHT)
      .attr('width', (segment) => Math.max(2, xScale(segment.end) - xScale(segment.start) - 1))
      .style('fill', (segment) => fill(segment.status))
      .attr('opacity', (segment) => (segment.status === 'pending' ? 0.5 : 1));
    spans
      .select<SVGTextElement>('text')
      .attr('x', (segment) => xScale(segment.start) + 6)
      .attr('y', BAR_TOP + BAR_HEIGHT / 2)
      .style('fill', (segment) =>
        segment.status === 'running' || segment.status === 'succeeded' ? 'white' : null,
      )
      .text((segment) =>
        xScale(segment.end) - xScale(segment.start) > 64
          ? `${STATUS_LABELS[segment.status] ?? segment.status} · ${seconds(segment.end - segment.start)}`
          : '',
      );

    root
      .selectAll<SVGLineElement, number>('line.poll')
      .data(this.polls())
      .join('line')
      .attr('class', 'poll')
      .attr('x1', (at) => xScale(at))
      .attr('x2', (at) => xScale(at))
      .attr('y1', BAR_TOP + BAR_HEIGHT + 3)
      .attr('y2', BAR_TOP + BAR_HEIGHT + 9)
      .style('stroke', CHART_COLORS.ink);
    root
      .selectAll<SVGTextElement, number>('text.total')
      .data([end])
      .join('text')
      .attr('class', 'total')
      .attr('x', width - MARGIN_X)
      .attr('y', HEIGHT - 4)
      .attr('text-anchor', 'end')
      .text((total) => `共 ${seconds(total)} · ${this.polls().length} 次轮询`);
  }
}

function fill(status: string): string {
  if (status === 'running' || status === 'succeeded') return CHART_COLORS.primary;
  if (status === 'failed') return CHART_COLORS.ink;
  return CHART_COLORS.empty;
}

function seconds(milliseconds: number): string {
  return `${d3.format('.1f')(milliseconds / 1000)}s`;
}

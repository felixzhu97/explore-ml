import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import * as d3 from 'd3';
import type { RankShift } from './chart-math';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS } from './scales';

const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;
const LABEL_WIDTH = 96;

/** Input order (left) versus ranked order (right); promoted candidates use the accent colour. */
@Component({
  selector: 'app-slope-chart',
  host: { class: 'block w-full text-fine [&_text]:fill-ink-80' },
  template: `<svg #svg role="img" [attr.aria-label]="ariaLabel()"></svg>`,
})
export class SlopeChart {
  readonly shifts = input.required<RankShift[]>();
  readonly fromLabel = input('输入顺序');
  readonly toLabel = input('排序结果');
  readonly ariaLabel = input.required<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const shifts = this.shifts();
    const width = this.width();
    const rows = Math.max(1, shifts.length);
    const height = HEADER_HEIGHT + rows * ROW_HEIGHT;
    const left = LABEL_WIDTH;
    const right = Math.max(left + 80, width - LABEL_WIDTH);
    const y = (index: number) => HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
    const promoted = (shift: RankShift) => shift.to !== null && shift.to < shift.from;
    const colour = (shift: RankShift) =>
      promoted(shift) ? CHART_COLORS.primary : CHART_COLORS.secondary;

    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', height);
    root
      .selectAll<SVGTextElement, [string, number, string]>('text.header')
      .data([
        [this.fromLabel(), left, 'end'],
        [this.toLabel(), right, 'start'],
      ] as [string, number, string][])
      .join('text')
      .attr('class', 'header')
      .attr('x', ([, x]) => x)
      .attr('y', 12)
      .attr('text-anchor', ([, , anchor]) => anchor)
      .attr('font-weight', 600)
      .text(([label]) => label);

    const groups = root
      .selectAll<SVGGElement, RankShift>('g.shift')
      .data(shifts, (shift) => shift.id)
      .join((enter) => {
        const group = enter.append('g').attr('class', 'shift');
        group.append('line');
        group.append('circle').attr('class', 'from').attr('r', 3);
        group.append('circle').attr('class', 'to').attr('r', 3);
        group.append('text').attr('class', 'from').attr('text-anchor', 'end');
        group.append('text').attr('class', 'to');
        return group;
      });
    groups
      .select('line')
      .attr('x1', left + 8)
      .attr('y1', (shift) => y(shift.from))
      .attr('x2', (shift) => (shift.to === null ? left + 8 : right - 8))
      .attr('y2', (shift) => y(shift.to ?? shift.from))
      .attr('stroke-width', 2)
      .style('stroke', colour);
    groups
      .select('circle.from')
      .attr('cx', left + 8)
      .attr('cy', (shift) => y(shift.from))
      .style('fill', colour);
    groups
      .select('circle.to')
      .attr('cx', right - 8)
      .attr('cy', (shift) => y(shift.to ?? 0))
      .attr('display', (shift) => (shift.to === null ? 'none' : null))
      .style('fill', colour);
    groups
      .select('text.from')
      .attr('x', left)
      .attr('y', (shift) => y(shift.from))
      .attr('dominant-baseline', 'middle')
      .text((shift) => (shift.to === null ? `${shift.id}（未返回）` : shift.id));
    groups
      .select('text.to')
      .attr('x', right)
      .attr('y', (shift) => y(shift.to ?? 0))
      .attr('dominant-baseline', 'middle')
      .attr('display', (shift) => (shift.to === null ? 'none' : null))
      .text((shift) => `${shift.id} · ${d3.format('.3~f')(shift.score ?? 0)}`);
  }
}

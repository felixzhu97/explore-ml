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
import { confusionCells, heatScale, textOn, type ConfusionCell } from './scales';

const LABEL = 96;

/** Confusion-matrix heatmap (rows = truth, columns = prediction) rendered with d3. */
@Component({
  selector: 'app-confusion-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'chart' },
  template: `<svg #svg role="img" aria-label="混淆矩阵"></svg>`,
})
export class ConfusionMatrix {
  readonly labels = input.required<string[]>();
  readonly matrix = input.required<number[][]>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const labels = this.labels();
    const cells = confusionCells(this.matrix());
    const size = Math.max(120, Math.min(this.width() - LABEL, 64 * labels.length));
    const band = d3
      .scaleBand<number>()
      .domain(d3.range(labels.length))
      .range([0, size])
      .padding(0.04);
    const color = heatScale(d3.max(cells, (c) => c.count) ?? 1);
    const root = d3
      .select(this.svg().nativeElement)
      .attr('width', LABEL + size)
      .attr('height', LABEL + size);

    const grid = root
      .selectAll<SVGGElement, null>('g.grid')
      .data([null])
      .join('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${LABEL}, ${LABEL})`);

    const cell = grid
      .selectAll<SVGGElement, ConfusionCell>('g.cell')
      .data(cells, (c) => `${c.row}-${c.col}`)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'cell');
        g.append('rect').attr('rx', 3);
        g.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central');
        g.append('title');
        return g;
      });
    cell.attr('transform', (c) => `translate(${band(c.col)}, ${band(c.row)})`);
    cell
      .select('rect')
      .attr('width', band.bandwidth())
      .attr('height', band.bandwidth())
      .attr('fill', (c) => color(c.count))
      .attr('stroke', (c) => (c.row === c.col ? '#1d1d1f' : 'none'));
    cell
      .select('text')
      .attr('x', band.bandwidth() / 2)
      .attr('y', band.bandwidth() / 2)
      .style('fill', (c) => textOn(color(c.count)))
      .text((c) => c.count);
    cell
      .select('title')
      .text(
        (c) =>
          `真实 ${labels[c.row]} → 预测 ${labels[c.col]}：${c.count}（${(c.rowShare * 100).toFixed(1)}%）`,
      );

    root
      .selectAll('text.row-label')
      .data(labels)
      .join('text')
      .attr('class', 'row-label')
      .attr('x', LABEL - 6)
      .attr('y', (_, i) => LABEL + (band(i) ?? 0) + band.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .text((l) => l);
    root
      .selectAll('text.col-label')
      .data(labels)
      .join('text')
      .attr('class', 'col-label')
      .attr(
        'transform',
        (_, i) =>
          `translate(${LABEL + (band(i) ?? 0) + band.bandwidth() / 2}, ${LABEL - 6}) rotate(-45)`,
      )
      .attr('text-anchor', 'start')
      .text((l) => l);
  }
}

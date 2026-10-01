import {
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import * as d3 from 'd3';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS } from './scales';

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  group: string;
  label: string;
  detail: string;
}

const MARGIN = 12;
const SYMBOLS = d3.symbolsFill;

/**
 * Zoomable 2-D scatter: groups get distinct symbols; the highlighted group uses the accent colour
 * and the rest fade to grey. Wheel or pinch to zoom, drag to pan, hover for the chunk text.
 */
@Component({
  selector: 'app-scatter-chart',
  host: { class: 'relative block w-full text-fine' },
  template: `
    <svg
      #svg
      class="block cursor-grab rounded-md bg-white active:cursor-grabbing"
      role="img"
      [attr.aria-label]="ariaLabel()"
    ></svg>
    @if (hovered(); as point) {
      <div
        class="pointer-events-none absolute z-10 flex max-w-72 flex-col gap-1 rounded-md bg-ink p-2 text-fine text-white"
        [style.left.px]="tooltip().left"
        [style.top.px]="tooltip().top"
      >
        <span class="font-semibold">{{ point.label }}</span>
        <span class="text-white/80">{{ point.detail }}</span>
      </div>
    }
  `,
})
export class ScatterChart {
  readonly points = input.required<ScatterPoint[]>();
  readonly groups = input.required<string[]>();
  readonly highlight = input<string | null>(null);
  readonly height = input(420);
  readonly ariaLabel = input.required<string>();

  protected readonly hovered = signal<ScatterPoint | null>(null);
  protected readonly tooltip = signal({ left: 0, top: 0 });
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth();
  private transform = d3.zoomIdentity;
  private zoom?: d3.ZoomBehavior<SVGSVGElement, unknown>;

  constructor() {
    afterRenderEffect(() => this.render());
  }

  private render(): void {
    const points = this.points();
    const groups = this.groups();
    const highlight = this.highlight();
    const width = this.width();
    const height = this.height();
    const xExtent = paddedExtent(points.map((point) => point.x));
    const yExtent = paddedExtent(points.map((point) => point.y));
    const xBase = d3
      .scaleLinear()
      .domain(xExtent)
      .range([MARGIN, width - MARGIN]);
    const yBase = d3
      .scaleLinear()
      .domain(yExtent)
      .range([height - MARGIN, MARGIN]);
    const symbolIndex = new Map(groups.map((group, index) => [group, index % SYMBOLS.length]));
    const symbol = d3.symbol().size(42);

    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', height);
    const layer = root
      .selectAll<SVGGElement, null>('g.points')
      .data([null])
      .join('g')
      .attr('class', 'points');

    const marks = layer
      .selectAll<SVGPathElement, ScatterPoint>('path.point')
      .data(points, (point) => point.id)
      .join('path')
      .attr('class', 'point')
      .attr('d', (point) => symbol.type(SYMBOLS[symbolIndex.get(point.group) ?? 0])())
      .style('fill', (point) =>
        highlight && point.group !== highlight ? CHART_COLORS.secondary : CHART_COLORS.primary,
      )
      .attr('opacity', (point) => (highlight && point.group !== highlight ? 0.25 : 0.8))
      .on('mouseenter', (event: MouseEvent, point) => {
        const [left, top] = d3.pointer(event, this.svg().nativeElement);
        this.tooltip.set({ left: Math.min(left + 12, width - 288), top: top + 12 });
        this.hovered.set(point);
      })
      .on('mouseleave', () => this.hovered.set(null));
    marks.filter((point) => point.group === highlight).raise();

    const place = (transform: d3.ZoomTransform) => {
      const x = transform.rescaleX(xBase);
      const y = transform.rescaleY(yBase);
      marks.attr('transform', (point) => `translate(${x(point.x)}, ${y(point.y)})`);
    };
    if (!this.zoom) {
      this.zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 40]);
      root.call(this.zoom);
    }
    this.zoom.on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      this.transform = event.transform;
      untracked(() => this.hovered.set(null));
      place(event.transform);
    });
    place(this.transform);
  }

  resetZoom(): void {
    if (this.zoom) {
      d3.select(this.svg().nativeElement)
        .transition()
        .duration(300)
        .call(this.zoom.transform, d3.zoomIdentity);
    }
  }
}

function paddedExtent(values: number[]): [number, number] {
  const [min = 0, max = 1] = d3.extent(values);
  const padding = (max - min) * 0.05 || 1;
  return [min - padding, max + padding];
}

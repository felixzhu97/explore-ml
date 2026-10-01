import * as d3 from 'd3';
import type { OverlayProxy } from 'embedding-atlas';
import { CHART_COLORS } from '../../charts/scales';

export interface Marker {
  x: number;
  y: number;
  n: number;
}

interface OverlayProps {
  proxy: OverlayProxy;
  markers: Marker[];
}

/** embedding-atlas custom overlay: numbered d3 markers for query hits. */
export class MarkersOverlay {
  private readonly svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;

  constructor(node: HTMLDivElement, props: OverlayProps) {
    this.svg = d3
      .select(node)
      .append('svg')
      .style('position', 'absolute')
      .style('inset', '0')
      .style('pointer-events', 'none');
    this.update(props);
  }

  update({ proxy, markers }: OverlayProps): void {
    this.svg.attr('width', proxy.width).attr('height', proxy.height);
    const g = this.svg
      .selectAll<SVGGElement, Marker>('g.marker')
      .data(markers, (d) => d.n)
      .join((enter) => {
        const m = enter.append('g').attr('class', 'marker');
        m.append('circle')
          .attr('r', 11)
          .attr('fill', CHART_COLORS.primary)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2);
        m.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('fill', '#ffffff')
          .attr('font-size', 12)
          .attr('font-weight', 600);
        return m;
      });
    g.attr('transform', (d) => {
      const p = proxy.location(d.x, d.y);
      return `translate(${p.x}, ${p.y})`;
    });
    g.select('text').text((d) => d.n);
  }

  destroy(): void {
    this.svg.remove();
  }
}

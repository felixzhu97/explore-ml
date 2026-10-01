import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import * as d3 from 'd3';
import { observeHostWidth } from './observe-width';
import { CHART_COLORS } from './scales';
import { computePeaks, decodeAudio, type Peak } from './waveform';

/** d3 waveform for an audio file/URL (`source`) or a live peak stream (`peaks`). */
@Component({
  selector: 'app-waveform',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'chart' },
  template: `
    <svg #svg role="img" aria-label="音频波形"></svg>
    @if (error()) {
      <p class="caption">{{ error() }}</p>
    } @else if (duration()) {
      <p class="caption">{{ duration().toFixed(2) }} s</p>
    }
  `,
})
export class WaveformChart {
  readonly source = input<Blob | string>();
  readonly peaks = input<Peak[]>();
  readonly height = input(96);

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly width = observeHostWidth(600);
  private readonly decoded = signal<Peak[]>([]);
  protected readonly duration = signal(0);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const src = this.source();
      if (!src) return;
      this.error.set('');
      decodeAudio(src)
        .then((buf) => {
          this.duration.set(buf.duration);
          this.decoded.set(computePeaks(buf.getChannelData(0), 400));
        })
        .catch((e: unknown) => {
          this.error.set(`无法解码音频：${e instanceof Error ? e.message : e}`);
          this.decoded.set([]);
        });
    });
    afterRenderEffect(() => this.render(this.peaks() ?? this.decoded()));
  }

  private render(peaks: Peak[]): void {
    const width = this.width();
    const height = this.height();
    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, peaks.length - 1)])
      .range([0, width]);
    const y = d3.scaleLinear().domain([-1, 1]).range([height, 0]);
    const area = d3
      .area<Peak>()
      .x((_, i) => x(i))
      .y0((d) => y(d.min))
      .y1((d) => y(d.max))
      .curve(d3.curveStep);
    const root = d3.select(this.svg().nativeElement).attr('width', width).attr('height', height);
    root
      .selectAll('line.mid')
      .data([0])
      .join('line')
      .attr('class', 'mid')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('stroke', CHART_COLORS.empty);
    root
      .selectAll('path.wave')
      .data([peaks])
      .join('path')
      .attr('class', 'wave')
      .attr('fill', CHART_COLORS.primary)
      .attr('d', area);
  }
}

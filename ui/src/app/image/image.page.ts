import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { Call } from '../shared/call';
import { Endpoint } from '../shared/endpoint';
import * as d3 from 'd3';
import { channelHistogram, type Series } from '../shared/chart-math';
import { JobTimeline } from '../shared/job-timeline';
import { JobTrace } from '../shared/job-trace';
import { LineChart } from '../shared/line-chart';
import { ModulePage } from '../shared/module-page';

const HISTOGRAM_SAMPLE_SIZE = 256;
import { ImageService } from './image.service';

@Component({
  selector: 'app-image-page',
  imports: [Endpoint, FormField, JobTimeline, LineChart, ModulePage, NzButtonModule, NzInputModule],
  template: `
    <app-module-page module="image">
      <app-endpoint
        title="文生图"
        path="/api/v1/images:generate → GET /api/v1/imageJobs/{id}"
        [call]="generateCall"
      >
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">prompt</span>
          <textarea nz-input rows="3" [formField]="requestForm.prompt"></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">negative_prompt（可选）</span>
          <input nz-input [formField]="requestForm.negativePrompt" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="generateCall.busy()"
            [disabled]="!formModel().prompt.trim()"
            (click)="run()"
          >
            生成
          </button>
        </div>
        @if (trace.segments().length) {
          <app-job-timeline
            [segments]="trace.segments()"
            [polls]="trace.polls()"
            ariaLabel="图像生成任务状态时间线"
          />
        }
        @if (url()) {
          <img
            class="max-w-full rounded-md"
            [src]="url()"
            alt="生成结果"
            (load)="analyse($event)"
          />
        }
        @if (histogram().length) {
          <section class="flex flex-col gap-2">
            <h3 class="m-0 text-caption font-semibold text-ink-80">RGB 直方图 · 各通道像素占比</h3>
            <app-line-chart
              [series]="histogram()"
              [xMin]="0"
              [xFormat]="formatIntensity"
              [yFormat]="formatShare"
              ariaLabel="生成图像的 RGB 通道直方图"
            />
          </section>
        }
      </app-endpoint>
    </app-module-page>
  `,
})
export class ImagePage {
  private readonly imageService = inject(ImageService);
  protected readonly formModel = signal({
    prompt: 'a red fox in the snow, studio light',
    negativePrompt: '',
  });
  protected readonly requestForm = form(this.formModel);
  protected readonly generateCall = new Call<{ status: string; jobId?: string; url?: string }>();
  protected readonly url = computed(() => this.generateCall.value()?.url);
  protected readonly trace = new JobTrace();
  protected readonly histogram = signal<Series[]>([]);
  protected readonly formatIntensity = d3.format('d');
  protected readonly formatShare = d3.format('.0%');

  /** Samples the loaded image on a canvas; the proxy keeps it same-origin, so pixels are readable. */
  protected analyse(loadEvent: Event): void {
    const image = loadEvent.target as HTMLImageElement;
    const scale = Math.min(
      1,
      HISTOGRAM_SAMPLE_SIZE / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    this.histogram.set(
      channelHistogram(context.getImageData(0, 0, canvas.width, canvas.height).data),
    );
  }

  protected run(): Promise<void> {
    const values = this.formModel();
    this.trace.start();
    this.histogram.set([]);
    return this.generateCall.run(async (setValue) => {
      const generated = await this.imageService.generate(
        values.prompt.trim(),
        values.negativePrompt.trim(),
        {
          onStatus: (status) => {
            this.trace.record(status);
            setValue({ status });
          },
        },
      );
      return { status: 'succeeded', ...generated };
    });
  }
}

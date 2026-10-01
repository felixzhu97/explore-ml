import { Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import * as d3 from 'd3';
import { BarChart } from '../shared/bar-chart';
import { Call } from '../shared/call';
import { flaggedPoints, frameSeries } from '../shared/chart-math';
import { LineChart, type Rule } from '../shared/line-chart';
import { Endpoint } from '../shared/endpoint';
import { FilePick } from '../shared/file-pick';
import { ModulePage } from '../shared/module-page';
import type { BarDatum } from '../shared/scales';
import {
  VisionService,
  type ModerationResult,
  type PredictionResult,
  type VisionInput,
} from './vision.service';

type Target = 'predict' | 'moderateImage' | 'moderateVideo';

const formatPercent = d3.format('.1%');

/** Every scored or thresholded category; older responses only carry flagged categories. */
function categoryBars(result: ModerationResult | undefined): BarDatum[] {
  if (!result) return [];
  const thresholds = result.thresholds ?? {};
  const scores =
    result.scores ??
    Object.fromEntries(result.categories.map((category) => [category.label, category.score]));
  const labels = [...new Set([...Object.keys(thresholds), ...Object.keys(scores)])];
  return labels.map((label) => ({
    label,
    value: scores[label] ?? 0,
    threshold: thresholds[label],
  }));
}

function thresholdRules(result: ModerationResult | undefined): Rule[] {
  return Object.entries(result?.thresholds ?? {}).map(([label, value]) => ({
    value,
    label: `${label} ≥ ${value}`,
  }));
}

@Component({
  selector: 'app-vision-page',
  imports: [
    BarChart,
    Endpoint,
    FilePick,
    LineChart,
    ModulePage,
    NzButtonModule,
    NzInputModule,
    NzTagModule,
  ],
  template: `
    <app-module-page module="vision">
      @for (endpoint of endpoints; track endpoint.target) {
        <app-endpoint
          [title]="endpoint.title"
          [path]="endpoint.path"
          [call]="calls[endpoint.target]"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <span class="text-caption font-semibold text-ink-80">上传文件</span>
              <app-file-pick [accept]="endpoint.accept" (picked)="pick(endpoint.target, $event)" />
            </div>
            <label class="flex flex-col gap-1">
              <span class="text-caption font-semibold text-ink-80">或填写 URL</span>
              <input
                nz-input
                [placeholder]="endpoint.placeholder"
                [value]="urls()[endpoint.target]"
                (input)="setUrl(endpoint.target, $event)"
              />
            </label>
          </div>
          <div>
            <button
              nz-button
              nzType="primary"
              nzShape="round"
              [nzLoading]="calls[endpoint.target].busy()"
              [disabled]="!input(endpoint.target)"
              (click)="run(endpoint.target)"
            >
              发送
            </button>
          </div>
          @if (endpoint.target === 'predict') {
            @if (predictionBars().length) {
              <app-bar-chart
                [data]="predictionBars()"
                [format]="formatPercent"
                ariaLabel="分类概率"
              />
            } @else if (labels().length) {
              <div class="flex flex-wrap gap-2">
                @for (label of labels(); track $index) {
                  <nz-tag [nzColor]="$first ? 'processing' : 'default'"
                    >{{ $index + 1 }}. {{ label }}</nz-tag
                  >
                }
              </div>
            }
          } @else {
            @let result = calls[endpoint.target].value();
            @let moderationBars = endpoint.target === 'moderateImage' ? imageBars() : videoBars();
            @if (result) {
              <span>
                <nz-tag [nzColor]="result.safe ? 'success' : 'error'">{{
                  result.safe ? '通过' : '拒绝'
                }}</nz-tag>
              </span>
            }
            @if (moderationBars.length) {
              <section class="flex flex-col gap-2">
                <h3 class="m-0 text-caption font-semibold text-ink-80">
                  {{ endpoint.target === 'moderateVideo' ? '各类别峰值分数' : '各类别分数' }}
                  · 竖线为阈值
                </h3>
                <app-bar-chart [data]="moderationBars" [max]="1" ariaLabel="审核类别分数与阈值" />
              </section>
            }
            @if (endpoint.target === 'moderateVideo' && frames().length) {
              <section class="flex flex-col gap-2">
                <h3 class="m-0 text-caption font-semibold text-ink-80">
                  逐帧时间线 · {{ frames().length }} 帧，{{ unsafeFrames() }} 帧超阈值
                </h3>
                <app-line-chart
                  [series]="frameScores()"
                  [thresholds]="videoRules()"
                  [highlights]="flagged()"
                  [yMax]="1"
                  [xFormat]="formatSeconds"
                  [yFormat]="formatScore"
                  ariaLabel="视频逐帧审核分数"
                />
              </section>
            }
          }
        </app-endpoint>
      }
    </app-module-page>
  `,
})
export class VisionPage {
  private readonly visionService = inject(VisionService);
  protected readonly endpoints = [
    {
      target: 'predict',
      title: '图像分类',
      path: '/api/v1/images:predict',
      accept: 'image/*',
      placeholder: 'https://example.com/cat.jpg',
    },
    {
      target: 'moderateImage',
      title: '图像审核',
      path: '/api/v1/images:moderate',
      accept: 'image/*',
      placeholder: 'https://example.com/cat.jpg',
    },
    {
      target: 'moderateVideo',
      title: '视频审核',
      path: '/api/v1/videos:moderate',
      accept: 'video/*',
      placeholder: 'https://example.com/clip.mp4',
    },
  ] as const;
  protected readonly calls = {
    predict: new Call<PredictionResult>(),
    moderateImage: new Call<ModerationResult>(),
    moderateVideo: new Call<ModerationResult>(),
  };
  protected readonly files = signal<Record<Target, File | null>>({
    predict: null,
    moderateImage: null,
    moderateVideo: null,
  });
  protected readonly urls = signal<Record<Target, string>>({
    predict: '',
    moderateImage: '',
    moderateVideo: '',
  });
  protected readonly labels = computed(() => this.calls.predict.value()?.labels ?? []);
  protected readonly imageBars = computed(() => categoryBars(this.calls.moderateImage.value()));
  protected readonly videoBars = computed(() => categoryBars(this.calls.moderateVideo.value()));
  protected readonly predictionBars = computed(() =>
    (this.calls.predict.value()?.predictions ?? []).map((prediction) => ({
      label: prediction.label,
      value: prediction.score,
    })),
  );
  protected readonly frames = computed(() => this.calls.moderateVideo.value()?.frames ?? []);
  protected readonly frameScores = computed(() => frameSeries(this.frames()));
  protected readonly videoRules = computed(() => thresholdRules(this.calls.moderateVideo.value()));
  protected readonly flagged = computed(() =>
    flaggedPoints(this.frames(), this.calls.moderateVideo.value()?.thresholds ?? {}),
  );
  protected readonly unsafeFrames = computed(
    () => this.frames().filter((frame) => !frame.safe).length,
  );
  protected readonly formatPercent = formatPercent;
  protected readonly formatScore = d3.format('.1f');
  protected readonly formatSeconds = (seconds: number) => `${d3.format('.1~f')(seconds)}s`;

  protected pick(target: Target, file: File | null): void {
    this.files.update((files) => ({ ...files, [target]: file }));
  }

  protected setUrl(target: Target, inputEvent: Event): void {
    const url = (inputEvent.target as HTMLInputElement).value;
    this.urls.update((urls) => ({ ...urls, [target]: url }));
  }

  protected input(target: Target): VisionInput | null {
    const file = this.files()[target];
    if (file) return { file };
    const url = this.urls()[target].trim();
    return url ? { url } : null;
  }

  protected run(target: Target): Promise<void> {
    const input = this.input(target)!;
    if (target === 'predict') {
      return this.calls.predict.run(() => this.visionService.predictImage(input));
    }
    if (target === 'moderateImage') {
      return this.calls.moderateImage.run(() => this.visionService.moderateImage(input));
    }
    return this.calls.moderateVideo.run(() => this.visionService.moderateVideo(input));
  }
}

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BarChart } from '../charts/bar-chart';
import {
  moderateImage,
  moderateVideo,
  predictImage,
  type ModerationResult,
  type VisionInput,
} from '../core/api/clients';
import { Call } from '../core/call';
import { Endpoint } from '../ui/endpoint';
import { ModulePage } from '../ui/module-page';

type Target = 'predict' | 'moderateImage' | 'moderateVideo';

function bars(r: ModerationResult | undefined) {
  return (r?.categories ?? []).map((c) => ({ label: c.label, value: c.score }));
}

@Component({
  selector: 'app-vision-page',
  imports: [BarChart, Endpoint, ModulePage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="vision">
      @for (e of endpoints; track e.target) {
        <app-endpoint [title]="e.title" [path]="e.path" [call]="calls[e.target]">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-ink-80">上传文件</span>
              <input
                type="file"
                class="text-sm file:mr-3 file:h-9 file:rounded-full file:border file:border-primary file:bg-white file:px-4 file:text-primary"
                [accept]="e.accept"
                (change)="pick(e.target, $event)"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-ink-80">或填写 URL</span>
              <input
                class="h-11 rounded-xl border border-hairline px-3.5"
                [placeholder]="e.placeholder"
                [value]="urls()[e.target]"
                (input)="setUrl(e.target, $event)"
              />
            </label>
          </div>
          <div>
            <button
              class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
              [disabled]="calls[e.target].busy() || !input(e.target)"
              (click)="run(e.target)"
            >
              发送
            </button>
          </div>
          @if (e.target === 'predict') {
            @if (labels().length) {
              <ol class="list-decimal pl-6">
                @for (l of labels(); track $index) {
                  <li>{{ l }}</li>
                }
              </ol>
            }
          } @else {
            @let b = e.target === 'moderateImage' ? imageBars() : videoBars();
            @if (b.length) {
              <app-bar-chart [data]="b" [max]="1" ariaLabel="审核类别分数" />
            }
          }
        </app-endpoint>
      }
    </app-module-page>
  `,
})
export class VisionPage {
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
    predict: new Call<{ labels: string[] }>(),
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
  protected readonly imageBars = computed(() => bars(this.calls.moderateImage.value()));
  protected readonly videoBars = computed(() => bars(this.calls.moderateVideo.value()));

  protected pick(target: Target, e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.files.update((f) => ({ ...f, [target]: file }));
  }

  protected setUrl(target: Target, e: Event): void {
    const url = (e.target as HTMLInputElement).value;
    this.urls.update((u) => ({ ...u, [target]: url }));
  }

  protected input(target: Target): VisionInput | null {
    const file = this.files()[target];
    if (file) return { file };
    const url = this.urls()[target].trim();
    return url ? { url } : null;
  }

  protected run(target: Target): Promise<void> {
    const input = this.input(target)!;
    if (target === 'predict') return this.calls.predict.run(() => predictImage(input));
    if (target === 'moderateImage') return this.calls.moderateImage.run(() => moderateImage(input));
    return this.calls.moderateVideo.run(() => moderateVideo(input));
  }
}

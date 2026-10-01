import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
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
import { FilePick } from '../ui/file-pick';
import { ModulePage } from '../ui/module-page';

type Target = 'predict' | 'moderateImage' | 'moderateVideo';

function bars(r: ModerationResult | undefined) {
  return (r?.categories ?? []).map((c) => ({ label: c.label, value: c.score }));
}

@Component({
  selector: 'app-vision-page',
  imports: [BarChart, Endpoint, FilePick, ModulePage, NzButtonModule, NzInputModule, NzTagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="vision">
      @for (e of endpoints; track e.target) {
        <app-endpoint [title]="e.title" [path]="e.path" [call]="calls[e.target]">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-ink-80">上传文件</span>
              <app-file-pick [accept]="e.accept" (picked)="pick(e.target, $event)" />
            </div>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-ink-80">或填写 URL</span>
              <input
                nz-input
                [placeholder]="e.placeholder"
                [value]="urls()[e.target]"
                (input)="setUrl(e.target, $event)"
              />
            </label>
          </div>
          <div>
            <button
              nz-button
              nzType="primary"
              nzShape="round"
              [nzLoading]="calls[e.target].busy()"
              [disabled]="!input(e.target)"
              (click)="run(e.target)"
            >
              发送
            </button>
          </div>
          @if (e.target === 'predict') {
            @if (labels().length) {
              <div class="flex flex-wrap gap-2">
                @for (l of labels(); track $index) {
                  <nz-tag [nzColor]="$first ? 'processing' : 'default'"
                    >{{ $index + 1 }}. {{ l }}</nz-tag
                  >
                }
              </div>
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

  protected pick(target: Target, file: File | null): void {
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

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { BarChart } from '../../charts/bar-chart';
import {
  moderateImage,
  moderateVideo,
  predictImage,
  type ModerationResult,
  type VisionInput,
} from '../../core/api/clients';
import { errorMessage } from '../../core/http';

const DEFAULT_THRESHOLD = 0.15;

@Component({
  selector: 'app-vision-playground',
  imports: [BarChart, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="card drop"
      [class.over]="dragOver()"
      (dragover)="$event.preventDefault(); dragOver.set(true)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <div class="row">
        <label class="field">
          <span>上传或拖入图片 / 视频</span>
          <input type="file" accept="image/*,video/*" (change)="onPick($event)" />
        </label>
        <label class="field grow"
          ><span>或媒体 URL</span><input [formField]="f.url" placeholder="https://…"
        /></label>
        <label class="field">
          <span>类型</span>
          <select [formField]="f.kind">
            <option value="image">图片</option>
            <option value="video">视频</option>
          </select>
        </label>
      </div>
      <div class="row">
        <button class="btn btn-primary" [disabled]="busy() || !input()" (click)="run()">
          {{ model().kind === 'image' ? '识别与审核' : '审核视频' }}
        </button>
        @if (file()) {
          <span class="caption">{{ file()!.name }}</span>
        }
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>

    <div class="grid">
      @if (preview() && model().kind === 'image') {
        <div class="card"><img [src]="preview()" alt="待识别图片" /></div>
      }
      @if (labels().length) {
        <div class="card">
          <h3>Top 标签</h3>
          <ol>
            @for (l of labels(); track l) {
              <li>{{ l }}</li>
            }
          </ol>
        </div>
      }
      @if (moderation(); as m) {
        <div class="card">
          <h3>内容审核：{{ m.safe ? '安全' : '不安全' }}</h3>
          @if (modBars().length) {
            <app-bar-chart
              [data]="modBars()"
              [max]="1"
              [threshold]="threshold"
              ariaLabel="审核类别分数"
            />
          } @else {
            <p class="caption">未命中任何类别</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .grow {
      flex: 1;
      min-width: 240px;
    }
    .drop.over {
      border-color: var(--color-primary);
    }
    img {
      width: 100%;
      border-radius: var(--radius-md);
    }
    ol {
      margin: 0;
      padding-left: 1.2em;
    }
  `,
})
export class VisionPlayground {
  private readonly model = signal({ url: '', kind: 'image' as 'image' | 'video' });
  protected readonly f = form(this.model);
  protected readonly file = signal<File | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly labels = signal<string[]>([]);
  protected readonly moderation = signal<ModerationResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly threshold = {
    value: DEFAULT_THRESHOLD,
    label: `默认阈值 ${DEFAULT_THRESHOLD}`,
  };

  protected readonly preview = computed(() => {
    const f = this.file();
    return f ? URL.createObjectURL(f) : this.model().url.trim();
  });
  protected readonly input = computed<VisionInput | null>(() => {
    const f = this.file();
    if (f) return { file: f };
    const url = this.model().url.trim();
    return url ? { url } : null;
  });
  protected readonly modBars = computed(() =>
    (this.moderation()?.categories ?? []).map((c) => ({ label: c.label, value: c.score })),
  );

  protected onPick(e: Event): void {
    this.setFile((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    this.setFile(e.dataTransfer?.files[0] ?? null);
  }

  private setFile(f: File | null): void {
    this.file.set(f);
    if (f)
      this.model.update((m) => ({ ...m, kind: f.type.startsWith('video/') ? 'video' : 'image' }));
  }

  protected async run(): Promise<void> {
    const i = this.input();
    if (!i) return;
    this.busy.set(true);
    this.error.set('');
    this.labels.set([]);
    try {
      if (this.model().kind === 'video') {
        this.moderation.set(await moderateVideo(i));
      } else {
        const [p, m] = await Promise.all([predictImage(i), moderateImage(i)]);
        this.labels.set(p.labels);
        this.moderation.set(m);
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

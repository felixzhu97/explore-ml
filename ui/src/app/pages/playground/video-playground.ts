import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { generateVideo } from '../../core/api/clients';
import { errorMessage } from '../../core/http';

@Component({
  selector: 'app-video-playground',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <label class="field">
        <span>提示词</span>
        <textarea
          [formField]="f.prompt"
          placeholder="waves rolling onto a beach at sunset"
        ></textarea>
      </label>
      <div class="row">
        <button
          class="btn btn-primary"
          [disabled]="busy() || !model().prompt.trim()"
          (click)="run()"
        >
          生成视频
        </button>
        @if (status()) {
          <p class="caption">任务状态：{{ status() }}</p>
        }
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>
    @if (url()) {
      <div class="card">
        <video [src]="url()" controls></video>
        <a [href]="url()" download>下载 MP4</a>
      </div>
    }
  `,
  styles: `
    video {
      width: 100%;
      max-width: 720px;
      border-radius: var(--radius-md);
    }
  `,
})
export class VideoPlayground {
  protected readonly model = signal({ prompt: '' });
  protected readonly f = form(this.model);
  protected readonly status = signal('');
  protected readonly url = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async run(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.url.set('');
    this.status.set('submitted');
    try {
      const res = await generateVideo(this.model().prompt.trim(), {
        intervalMs: 3000,
        onStatus: (s) => this.status.set(s),
      });
      this.url.set(res.url);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

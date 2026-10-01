import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { generateImage } from '../../core/api/clients';
import { errorMessage } from '../../core/http';

@Component({
  selector: 'app-image-playground',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <label class="field">
        <span>提示词</span>
        <textarea
          [formField]="f.prompt"
          placeholder="a ceramic teapot on a wooden table, soft light"
        ></textarea>
      </label>
      <label class="field"><span>反向提示词</span><input [formField]="f.negative" /></label>
      <div class="row">
        <button
          class="btn btn-primary"
          [disabled]="busy() || !model().prompt.trim()"
          (click)="run()"
        >
          生成
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
        <img [src]="url()" [alt]="model().prompt" />
        <a [href]="url()" download>下载 PNG</a>
      </div>
    }
  `,
  styles: `
    img {
      width: 100%;
      max-width: 640px;
      border-radius: var(--radius-md);
    }
  `,
})
export class ImagePlayground {
  protected readonly model = signal({ prompt: '', negative: '' });
  protected readonly f = form(this.model);
  protected readonly status = signal('');
  protected readonly url = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async run(): Promise<void> {
    const m = this.model();
    this.busy.set(true);
    this.error.set('');
    this.url.set('');
    this.status.set('submitted');
    try {
      const res = await generateImage(m.prompt.trim(), m.negative.trim(), {
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

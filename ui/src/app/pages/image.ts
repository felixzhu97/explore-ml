import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { generateImage } from '../core/api/clients';
import { Call } from '../core/call';
import { Endpoint } from '../ui/endpoint';
import { ModulePage } from '../ui/module-page';

@Component({
  selector: 'app-image-page',
  imports: [Endpoint, FormField, ModulePage, NzButtonModule, NzInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="image">
      <app-endpoint
        title="文生图"
        path="/api/v1/images:generate → GET /api/v1/imageJobs/{id}"
        [call]="call"
      >
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">prompt</span>
          <textarea nz-input rows="3" [formField]="f.prompt"></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">negative_prompt（可选）</span>
          <input nz-input [formField]="f.negative" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="call.busy()"
            [disabled]="!m().prompt.trim()"
            (click)="run()"
          >
            生成
          </button>
        </div>
        @if (url()) {
          <img class="max-w-full rounded-xl" [src]="url()" alt="生成结果" />
        }
      </app-endpoint>
    </app-module-page>
  `,
})
export class ImagePage {
  protected readonly m = signal({ prompt: 'a red fox in the snow, studio light', negative: '' });
  protected readonly f = form(this.m);
  protected readonly call = new Call<{ status: string; jobId?: string; url?: string }>();
  protected readonly url = computed(() => this.call.value()?.url);

  protected run(): Promise<void> {
    const m = this.m();
    return this.call.run(async (set) => {
      const r = await generateImage(m.prompt.trim(), m.negative.trim(), {
        onStatus: (status) => set({ status }),
      });
      return { status: 'succeeded', ...r };
    });
  }
}

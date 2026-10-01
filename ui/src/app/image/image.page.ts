import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { Call } from '../shared/call';
import { Endpoint } from '../shared/endpoint';
import { ModulePage } from '../shared/module-page';
import { ImageService } from './image.service';

@Component({
  selector: 'app-image-page',
  imports: [Endpoint, FormField, ModulePage, NzButtonModule, NzInputModule],
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
        @if (url()) {
          <img class="max-w-full rounded-md" [src]="url()" alt="生成结果" />
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

  protected run(): Promise<void> {
    const values = this.formModel();
    return this.generateCall.run(async (setValue) => {
      const generated = await this.imageService.generate(
        values.prompt.trim(),
        values.negativePrompt.trim(),
        {
          onStatus: (status) => setValue({ status }),
        },
      );
      return { status: 'succeeded', ...generated };
    });
  }
}

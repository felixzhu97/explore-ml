import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { Call } from '../shared/call';
import { Endpoint } from '../shared/endpoint';
import { ModulePage } from '../shared/module-page';
import { VideoService } from './video.service';

@Component({
  selector: 'app-video-page',
  imports: [Endpoint, FormField, ModulePage, NzButtonModule, NzInputModule],
  template: `
    <app-module-page module="video">
      <app-endpoint
        title="文生视频"
        path="/api/v1/videos:generate → GET /api/v1/videoJobs/{id}"
        [call]="generateCall"
      >
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">prompt</span>
          <textarea nz-input rows="3" [formField]="requestForm.prompt"></textarea>
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
          <video class="max-w-full rounded-md" [src]="url()" controls></video>
        }
      </app-endpoint>
    </app-module-page>
  `,
})
export class VideoPage {
  private readonly videoService = inject(VideoService);
  protected readonly formModel = signal({ prompt: 'waves rolling onto a beach at sunset' });
  protected readonly requestForm = form(this.formModel);
  protected readonly generateCall = new Call<{ status: string; jobId?: string; url?: string }>();
  protected readonly url = computed(() => this.generateCall.value()?.url);

  protected run(): Promise<void> {
    return this.generateCall.run(async (setValue) => {
      const generated = await this.videoService.generate(this.formModel().prompt.trim(), {
        onStatus: (status) => setValue({ status }),
      });
      return { status: 'succeeded', ...generated };
    });
  }
}

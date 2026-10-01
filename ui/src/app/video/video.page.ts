import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { generateVideo } from './video.api';
import { Call } from '../shared/call';
import { Endpoint } from '../shared/endpoint';
import { ModulePage } from '../shared/module-page';

@Component({
  selector: 'app-video-page',
  imports: [Endpoint, FormField, ModulePage, NzButtonModule, NzInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="video">
      <app-endpoint
        title="文生视频"
        path="/api/v1/videos:generate → GET /api/v1/videoJobs/{id}"
        [call]="call"
      >
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">prompt</span>
          <textarea nz-input rows="3" [formField]="f.prompt"></textarea>
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
          <video class="max-w-full rounded-md" [src]="url()" controls></video>
        }
      </app-endpoint>
    </app-module-page>
  `,
})
export class VideoPage {
  protected readonly m = signal({ prompt: 'waves rolling onto a beach at sunset' });
  protected readonly f = form(this.m);
  protected readonly call = new Call<{ status: string; jobId?: string; url?: string }>();
  protected readonly url = computed(() => this.call.value()?.url);

  protected run(): Promise<void> {
    return this.call.run(async (set) => {
      const r = await generateVideo(this.m().prompt.trim(), {
        onStatus: (status) => set({ status }),
      });
      return { status: 'succeeded', ...r };
    });
  }
}

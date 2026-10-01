import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { generateVideo } from '../core/api/clients';
import { Call } from '../core/call';
import { Endpoint } from '../ui/endpoint';
import { ModulePage } from '../ui/module-page';

@Component({
  selector: 'app-video-page',
  imports: [Endpoint, FormField, ModulePage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="video">
      <app-endpoint
        title="文生视频"
        path="/api/v1/videos:generate → GET /api/v1/videoJobs/{id}"
        [call]="call"
      >
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">prompt</span>
          <textarea
            class="min-h-24 rounded-xl border border-hairline px-3.5 py-2.5"
            [formField]="f.prompt"
          ></textarea>
        </label>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="call.busy() || !m().prompt.trim()"
            (click)="run()"
          >
            生成
          </button>
        </div>
        @if (url()) {
          <video class="max-w-full rounded-xl" [src]="url()" controls></video>
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

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { synthesize, transcribe } from '../core/api/clients';
import { LiveAsr, type AsrEvent } from '../core/api/live-asr';
import { Call } from '../core/call';
import { Endpoint } from '../ui/endpoint';
import { FilePick } from '../ui/file-pick';
import { ModulePage } from '../ui/module-page';

@Component({
  selector: 'app-speech-page',
  imports: [Endpoint, FilePick, FormField, ModulePage, NzButtonModule, NzInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="speech">
      <app-endpoint title="语音合成" path="/api/v1/voices:synthesize" [call]="tts">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">text</span>
          <textarea nz-input rows="3" [formField]="f.text"></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">voice（可选）</span>
          <input nz-input placeholder="zh-CN-XiaoxiaoNeural" [formField]="f.voice" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="tts.busy()"
            [disabled]="!m().text.trim()"
            (click)="speak()"
          >
            合成
          </button>
        </div>
        @if (tts.value(); as r) {
          <audio class="w-full" [src]="r.audio_url" controls></audio>
        }
      </app-endpoint>

      <app-endpoint title="语音识别（文件）" path="/api/v1/audios:transcribe" [call]="asr">
        <app-file-pick accept="audio/*" (picked)="file.set($event)" />
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">language（可选）</span>
          <input nz-input placeholder="Chinese" [formField]="f.language" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="asr.busy()"
            [disabled]="!file()"
            (click)="listen()"
          >
            识别
          </button>
        </div>
      </app-endpoint>

      <app-endpoint
        title="实时语音识别（麦克风）"
        method="WS"
        path="/ws/v1/audios:transcribe"
        [call]="live"
      >
        <div>
          <button
            nz-button
            nzShape="round"
            [nzType]="liveOn() ? 'default' : 'primary'"
            (click)="toggleLive()"
          >
            {{ liveOn() ? '停止' : '开始' }}
          </button>
        </div>
      </app-endpoint>
    </app-module-page>
  `,
})
export class SpeechPage {
  protected readonly m = signal({ text: '你好，欢迎使用 Explore ML。', voice: '', language: '' });
  protected readonly f = form(this.m);
  protected readonly file = signal<File | null>(null);
  protected readonly tts = new Call<{ audio_url: string }>();
  protected readonly asr = new Call();
  protected readonly live = new Call<AsrEvent>();
  protected readonly liveOn = signal(false);
  private liveAsr?: LiveAsr;
  private endLive?: () => void;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopLive();
      this.liveAsr?.stop();
    });
  }

  protected speak(): Promise<void> {
    const m = this.m();
    return this.tts.run(async () => ({
      audio_url: await synthesize(m.text.trim(), m.voice.trim()),
    }));
  }

  protected listen(): Promise<void> {
    const file = this.file()!;
    return this.asr.run(() => transcribe(file, file.name, this.m().language.trim()));
  }

  protected toggleLive(): void {
    if (this.liveOn()) {
      this.stopLive();
      return;
    }
    this.liveOn.set(true);
    void this.live.run(async (set) => {
      const liveAsr = new LiveAsr({ onEvent: set });
      this.liveAsr = liveAsr;
      try {
        await liveAsr.start();
        await new Promise<void>((resolve) => (this.endLive = resolve));
      } finally {
        liveAsr.stop();
        this.liveOn.set(false);
      }
    });
  }

  private stopLive(): void {
    this.endLive?.();
    this.endLive = undefined;
  }
}

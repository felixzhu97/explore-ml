import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { synthesize, transcribe } from '../core/api/clients';
import { LiveAsr, type AsrEvent } from '../core/api/live-asr';
import { Call } from '../core/call';
import { Endpoint } from '../ui/endpoint';
import { ModulePage } from '../ui/module-page';

@Component({
  selector: 'app-speech-page',
  imports: [Endpoint, FormField, ModulePage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="speech">
      <app-endpoint title="语音合成" path="/api/v1/voices:synthesize" [call]="tts">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">text</span>
          <textarea
            class="min-h-24 rounded-xl border border-hairline px-3.5 py-2.5"
            [formField]="f.text"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">voice（可选）</span>
          <input
            class="h-11 rounded-xl border border-hairline px-3.5"
            placeholder="zh-CN-XiaoxiaoNeural"
            [formField]="f.voice"
          />
        </label>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="tts.busy() || !m().text.trim()"
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
        <input
          type="file"
          accept="audio/*"
          class="text-sm file:mr-3 file:h-9 file:rounded-full file:border file:border-primary file:bg-white file:px-4 file:text-primary"
          (change)="pick($event)"
        />
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">language（可选）</span>
          <input
            class="h-11 rounded-xl border border-hairline px-3.5"
            placeholder="Chinese"
            [formField]="f.language"
          />
        </label>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="asr.busy() || !file()"
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
            class="h-11 rounded-full px-5 active:scale-95"
            [class]="liveOn() ? 'border border-primary text-primary' : 'bg-primary text-white'"
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

  protected pick(e: Event): void {
    this.file.set((e.target as HTMLInputElement).files?.[0] ?? null);
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

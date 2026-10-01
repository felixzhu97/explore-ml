import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { Call } from '../shared/call';
import { Endpoint } from '../shared/endpoint';
import { FilePick } from '../shared/file-pick';
import { ModulePage } from '../shared/module-page';
import { LiveTranscription, type TranscriptionEvent } from './live-transcription';
import { SpeechService, type Transcription } from './speech.service';

@Component({
  selector: 'app-speech-page',
  imports: [Endpoint, FilePick, FormField, ModulePage, NzButtonModule, NzInputModule],
  template: `
    <app-module-page module="speech">
      <app-endpoint title="语音合成" path="/api/v1/voices:synthesize" [call]="synthesisCall">
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">text</span>
          <textarea nz-input rows="3" [formField]="requestForm.text"></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">voice（可选）</span>
          <input nz-input placeholder="zh-CN-XiaoxiaoNeural" [formField]="requestForm.voice" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="synthesisCall.busy()"
            [disabled]="!formModel().text.trim()"
            (click)="speak()"
          >
            合成
          </button>
        </div>
        @if (synthesisCall.value(); as synthesis) {
          <audio class="w-full" [src]="synthesis.audioUrl" controls></audio>
        }
      </app-endpoint>

      <app-endpoint
        title="语音识别（文件）"
        path="/api/v1/audios:transcribe"
        [call]="transcriptionCall"
      >
        <app-file-pick accept="audio/*" (picked)="file.set($event)" />
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">language（可选）</span>
          <input nz-input placeholder="Chinese" [formField]="requestForm.language" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="transcriptionCall.busy()"
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
        [call]="liveCall"
      >
        <div>
          <button
            nz-button
            nzShape="round"
            [nzType]="liveActive() ? 'default' : 'primary'"
            (click)="toggleLive()"
          >
            {{ liveActive() ? '停止' : '开始' }}
          </button>
        </div>
      </app-endpoint>
    </app-module-page>
  `,
})
export class SpeechPage {
  private readonly speechService = inject(SpeechService);
  protected readonly formModel = signal({
    text: '你好，欢迎使用 Explore ML。',
    voice: '',
    language: '',
  });
  protected readonly requestForm = form(this.formModel);
  protected readonly file = signal<File | null>(null);
  protected readonly synthesisCall = new Call<{ audioUrl: string }>();
  protected readonly transcriptionCall = new Call<Transcription>();
  protected readonly liveCall = new Call<TranscriptionEvent>();
  protected readonly liveActive = signal(false);
  private liveTranscription?: LiveTranscription;
  private endLive?: () => void;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopLive();
      this.liveTranscription?.stop();
    });
  }

  protected speak(): Promise<void> {
    const values = this.formModel();
    return this.synthesisCall.run(async () => ({
      audioUrl: await this.speechService.synthesize(values.text.trim(), values.voice.trim()),
    }));
  }

  protected listen(): Promise<void> {
    const file = this.file()!;
    return this.transcriptionCall.run(() =>
      this.speechService.transcribe(file, file.name, this.formModel().language.trim()),
    );
  }

  protected toggleLive(): void {
    if (this.liveActive()) {
      this.stopLive();
      return;
    }
    this.liveActive.set(true);
    void this.liveCall.run(async (setValue) => {
      const liveTranscription = new LiveTranscription({ onEvent: setValue });
      this.liveTranscription = liveTranscription;
      try {
        await liveTranscription.start();
        await new Promise<void>((resolve) => (this.endLive = resolve));
      } finally {
        liveTranscription.stop();
        this.liveActive.set(false);
      }
    });
  }

  private stopLive(): void {
    this.endLive?.();
    this.endLive = undefined;
  }
}

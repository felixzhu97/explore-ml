import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import * as d3 from 'd3';
import { decodeAudio, type DecodedAudio } from '../shared/audio';
import { Call } from '../shared/call';
import { rms, truncate, type Point } from '../shared/chart-math';
import { LineChart, type Rule } from '../shared/line-chart';
import { Waveform } from '../shared/waveform';
import { Endpoint } from '../shared/endpoint';
import { FilePick } from '../shared/file-pick';
import { ModulePage } from '../shared/module-page';

const LEVEL_HISTORY = 160;
const MAX_TRANSCRIPT_MARKERS = 6;
const MARKER_LABEL_LENGTH = 8;
import { LiveTranscription, type TranscriptionEvent } from './live-transcription';
import { SpeechService, type Transcription } from './speech.service';

@Component({
  selector: 'app-speech-page',
  imports: [
    Endpoint,
    FilePick,
    FormField,
    LineChart,
    ModulePage,
    NzButtonModule,
    NzInputModule,
    Waveform,
  ],
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
        @if (synthesisWave(); as wave) {
          <section class="flex flex-col gap-2">
            <h3 class="m-0 text-caption font-semibold text-ink-80">
              合成波形 · {{ formatSeconds(wave.durationSeconds) }}
            </h3>
            <app-waveform [envelope]="wave.envelope" ariaLabel="合成语音波形" />
          </section>
        }
      </app-endpoint>

      <app-endpoint
        title="语音识别（文件）"
        path="/api/v1/audios:transcribe"
        [call]="transcriptionCall"
      >
        <app-file-pick accept="audio/*" (picked)="pickAudio($event)" />
        @if (uploadWave(); as wave) {
          <section class="flex flex-col gap-2">
            <h3 class="m-0 text-caption font-semibold text-ink-80">
              上传音频波形 · {{ formatSeconds(wave.durationSeconds) }}
            </h3>
            <app-waveform [envelope]="wave.envelope" ariaLabel="上传音频波形" />
          </section>
        }
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
        @if (levels().length) {
          <section class="flex flex-col gap-2">
            <h3 class="m-0 text-caption font-semibold text-ink-80">
              麦克风音量（RMS）· 竖线为识别出的整句
            </h3>
            <app-line-chart
              [series]="[{ label: '音量', points: levels() }]"
              [markers]="transcriptMarkers()"
              [height]="160"
              [xFormat]="formatSeconds"
              [yFormat]="formatLevel"
              ariaLabel="实时麦克风音量与识别事件"
            />
          </section>
        }
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
  protected readonly synthesisWave = signal<DecodedAudio | null>(null);
  protected readonly uploadWave = signal<DecodedAudio | null>(null);
  protected readonly levels = signal<Point[]>([]);
  protected readonly transcriptMarkers = signal<Rule[]>([]);
  protected readonly formatSeconds = (seconds: number) => `${d3.format('.1f')(seconds)}s`;
  protected readonly formatLevel = d3.format('.2f');
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
    this.synthesisWave.set(null);
    return this.synthesisCall.run(async () => {
      const audioUrl = await this.speechService.synthesize(values.text.trim(), values.voice.trim());
      this.synthesisWave.set(await decodeAudio(audioUrl).catch(() => null));
      return { audioUrl };
    });
  }

  protected async pickAudio(file: File | null): Promise<void> {
    this.file.set(file);
    this.uploadWave.set(null);
    if (file) this.uploadWave.set(await decodeAudio(file).catch(() => null));
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
    this.levels.set([]);
    this.transcriptMarkers.set([]);
    const startedAt = performance.now();
    const elapsedSeconds = () => (performance.now() - startedAt) / 1000;
    void this.liveCall.run(async (setValue) => {
      const liveTranscription = new LiveTranscription({
        onEvent: (event) => {
          if (event.type === 'final' && event.text) {
            const marker = {
              value: elapsedSeconds(),
              label: truncate(event.text, MARKER_LABEL_LENGTH),
            };
            this.transcriptMarkers.update((markers) =>
              [...markers, marker].slice(-MAX_TRANSCRIPT_MARKERS),
            );
          }
          setValue(event);
        },
        onSamples: (samples) => {
          const level = { x: elapsedSeconds(), y: rms(samples) };
          this.levels.update((levels) => [...levels, level].slice(-LEVEL_HISTORY));
        },
      });
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

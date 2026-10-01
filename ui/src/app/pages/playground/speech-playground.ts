import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { WaveformChart } from '../../charts/waveform-chart';
import { appendPeak, type Peak } from '../../charts/waveform';
import { synthesize, transcribe } from '../../core/api/clients';
import { LiveAsr } from '../../core/api/live-asr';
import { errorMessage } from '../../core/http';

const LIVE_PEAKS = 300;

@Component({
  selector: 'app-speech-playground',
  imports: [FormField, WaveformChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid two">
      <div class="card">
        <h3>语音合成</h3>
        <label class="field"><span>文本</span><textarea [formField]="f.text"></textarea></label>
        <label class="field"
          ><span>音色（可选）</span><input [formField]="f.voice" placeholder="zh-CN-XiaoxiaoNeural"
        /></label>
        <div class="row">
          <button
            class="btn btn-primary"
            [disabled]="ttsBusy() || !model().text.trim()"
            (click)="speak()"
          >
            合成
          </button>
        </div>
        @if (ttsError()) {
          <p class="error">{{ ttsError() }}</p>
        }
        @if (audioUrl()) {
          <audio [src]="audioUrl()" controls></audio>
          <app-waveform [source]="audioUrl()" />
        }
      </div>

      <div class="card">
        <h3>语音识别</h3>
        <label class="field">
          <span>音频文件</span>
          <input type="file" accept="audio/*" (change)="onPick($event)" />
        </label>
        <label class="field"
          ><span>语言（可选）</span><input [formField]="f.language" placeholder="Chinese"
        /></label>
        <div class="row">
          <button class="btn btn-primary" [disabled]="asrBusy() || !file()" (click)="listen()">
            识别文件
          </button>
          <button class="btn btn-secondary" (click)="toggleLive()">
            {{ live() ? '停止实时识别' : '实时识别（麦克风）' }}
          </button>
        </div>
        @if (asrError()) {
          <p class="error">{{ asrError() }}</p>
        }
        @if (live() || livePeaks().length) {
          <app-waveform [peaks]="livePeaks()" />
        } @else if (file()) {
          <app-waveform [source]="file()!" />
        }
        @if (transcript()) {
          <p class="transcript">{{ transcript() }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    .two {
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    }
    audio {
      width: 100%;
    }
    .transcript {
      white-space: pre-wrap;
    }
  `,
})
export class SpeechPlayground {
  protected readonly model = signal({
    text: '你好，欢迎使用 Explore ML。',
    voice: '',
    language: '',
  });
  protected readonly f = form(this.model);
  protected readonly audioUrl = signal('');
  protected readonly ttsBusy = signal(false);
  protected readonly ttsError = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly transcript = signal('');
  protected readonly asrBusy = signal(false);
  protected readonly asrError = signal('');
  protected readonly live = signal(false);
  protected readonly livePeaks = signal<Peak[]>([]);
  private liveAsr?: LiveAsr;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liveAsr?.stop());
  }

  protected onPick(e: Event): void {
    this.file.set((e.target as HTMLInputElement).files?.[0] ?? null);
    this.livePeaks.set([]);
  }

  protected async speak(): Promise<void> {
    const m = this.model();
    this.ttsBusy.set(true);
    this.ttsError.set('');
    try {
      this.audioUrl.set(await synthesize(m.text.trim(), m.voice.trim()));
    } catch (e) {
      this.ttsError.set(errorMessage(e));
    } finally {
      this.ttsBusy.set(false);
    }
  }

  protected async listen(): Promise<void> {
    const file = this.file();
    if (!file) return;
    this.asrBusy.set(true);
    this.asrError.set('');
    try {
      const r = await transcribe(file, file.name, this.model().language.trim());
      this.transcript.set(r.language ? `${r.text}（${r.language}）` : r.text);
    } catch (e) {
      this.asrError.set(errorMessage(e));
    } finally {
      this.asrBusy.set(false);
    }
  }

  protected async toggleLive(): Promise<void> {
    if (this.live()) {
      this.liveAsr?.stop();
      this.live.set(false);
      return;
    }
    this.asrError.set('');
    this.transcript.set('');
    this.livePeaks.set([]);
    this.liveAsr = new LiveAsr({
      onSamples: (s) => this.livePeaks.update((p) => appendPeak(p, s, LIVE_PEAKS)),
      onEvent: (e) => {
        if (e.type === 'error') this.asrError.set(e.text);
        else if (e.text) this.transcript.set(e.text);
      },
    });
    try {
      await this.liveAsr.start();
      this.live.set(true);
    } catch (e) {
      this.liveAsr.stop();
      this.asrError.set(errorMessage(e));
    }
  }
}

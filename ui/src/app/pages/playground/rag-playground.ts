import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { BarChart } from '../../charts/bar-chart';
import {
  ragCollections,
  ragQuery,
  ragStreamQuery,
  ragUpload,
  type SourceDocument,
} from '../../core/api/clients';
import { errorMessage } from '../../core/http';

const DEFAULT_COLLECTIONS = ['documents', 'posts', 'comments', 'webpages'];

@Component({
  selector: 'app-rag-playground',
  imports: [BarChart, FormField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <label class="field">
        <span>问题</span>
        <textarea [formField]="f.query" placeholder="输入要检索的问题"></textarea>
      </label>
      <div class="row">
        <label class="field">
          <span>集合</span>
          <select [formField]="f.collection">
            @for (name of collections(); track name) {
              <option [value]="name">{{ name }}</option>
            }
          </select>
        </label>
        <label class="field"><span>Top K</span><input type="number" [formField]="f.topK" /></label>
        <label class="check"><input type="checkbox" [formField]="f.stream" /> 流式输出</label>
      </div>
      <div class="row">
        <button
          class="btn btn-primary"
          [disabled]="busy() || !model().query.trim()"
          (click)="ask()"
        >
          提问
        </button>
        @if (busy() && model().stream) {
          <button class="btn btn-secondary" (click)="stop()">停止</button>
        }
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>

    <div class="card">
      <h3>上传文档</h3>
      <input type="file" accept=".pdf,.html,.htm,.md,.txt,.docx,.doc" (change)="upload($event)" />
      @if (uploadNote()) {
        <p class="caption">{{ uploadNote() }}</p>
      }
    </div>

    @if (answer() || sources().length) {
      <div class="card">
        <h3>回答</h3>
        <p class="answer">{{ answer() }}</p>
        @if (meta()) {
          <p class="caption">{{ meta() }}</p>
        }
      </div>
    }

    @if (sources().length) {
      <div class="card">
        <h3>引用来源相似度</h3>
        <app-bar-chart [data]="bars()" [max]="1" ariaLabel="来源相似度" />
        <ol class="sources">
          @for (s of sources(); track s.id) {
            <li>
              <p class="caption">{{ s.text }}</p>
            </li>
          }
        </ol>
        <a routerLink="/atlas" [queryParams]="{ q: model().query, collection: model().collection }"
          >在向量地图中查看 →</a
        >
      </div>
    }
  `,
  styles: `
    .check {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
      min-height: 44px;
    }
    .answer {
      white-space: pre-wrap;
    }
    .sources {
      margin: 0;
      padding-left: 1.2em;
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }
  `,
})
export class RagPlayground {
  protected readonly model = signal({ query: '', collection: 'documents', topK: 5, stream: true });
  protected readonly f = form(this.model);
  protected readonly collections = signal(DEFAULT_COLLECTIONS);
  protected readonly answer = signal('');
  protected readonly sources = signal<SourceDocument[]>([]);
  protected readonly meta = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly uploadNote = signal('');
  protected readonly bars = computed(() =>
    this.sources().map((s, i) => ({
      label: `#${i + 1} ${String(s.metadata?.['filename'] ?? s.id).slice(0, 14)}`,
      value: s.score,
    })),
  );
  private controller?: AbortController;

  constructor() {
    ragCollections()
      .then((c) => c.length && this.collections.set(c.map((x) => x.name)))
      .catch(() => undefined);
  }

  protected stop(): void {
    this.controller?.abort();
  }

  protected async ask(): Promise<void> {
    const m = this.model();
    const body = { query: m.query.trim(), collection: m.collection, top_k: m.topK };
    const controller = new AbortController();
    this.controller = controller;
    this.busy.set(true);
    this.error.set('');
    this.answer.set('');
    this.sources.set([]);
    this.meta.set('');
    try {
      if (m.stream) {
        const [, res] = await Promise.all([
          ragStreamQuery(body, (t) => this.answer.update((a) => a + t), controller.signal),
          ragQuery(body).catch(() => null),
        ]);
        if (res) this.sources.set(res.sources);
      } else {
        const res = await ragQuery(body);
        this.answer.set(res.answer);
        this.sources.set(res.sources);
        this.meta.set(`检索 ${res.total_chunks_searched} 个片段 · ${res.generation_time_ms} ms`);
      }
    } catch (e) {
      if (!controller.signal.aborted) this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async upload(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadNote.set('上传中…');
    try {
      const r = await ragUpload(file);
      this.uploadNote.set(`${r.filename}：${r.chunks_count} 个片段（${r.status}）`);
    } catch (err) {
      this.uploadNote.set(errorMessage(err));
    }
  }
}

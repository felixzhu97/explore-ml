import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  ragCollections,
  ragCrawl,
  ragDeleteDocument,
  ragExportVectors,
  ragGetDocument,
  ragListDocuments,
  ragQuery,
  ragScrape,
  ragStreamQuery,
  ragSync,
  ragUpload,
  type SyncTarget,
} from '../core/api/clients';
import { Call } from '../core/call';
import { Endpoint } from '../ui/endpoint';
import { ModulePage } from '../ui/module-page';

const PREVIEW_POINTS = 20;
const PREVIEW_DIMS = 8;

@Component({
  selector: 'app-rag-page',
  imports: [Endpoint, FormField, ModulePage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="rag">
      <app-endpoint
        title="集合列表"
        method="GET"
        path="/api/v1/collections"
        [call]="calls.collections"
      >
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.collections.busy()"
            (click)="calls.collections.run(listCollections)"
          >
            查询
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="问答" path="/api/v1/documents:query" [call]="calls.query">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-sm font-semibold text-ink-80">问题</span>
            <textarea
              class="min-h-24 rounded-xl border border-hairline px-3.5 py-2.5"
              [formField]="f.query"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">collection（可选）</span>
            <input
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.collection"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">top_k（1–20）</span>
            <input
              type="number"
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.topK"
            />
          </label>
        </div>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.query.busy() || !m().query.trim()"
            (click)="runQuery()"
          >
            提问
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="流式问答" path="/api/v1/documents:streamQuery" [call]="calls.stream">
        <p class="text-sm text-muted">使用上方「问答」的问题、集合与 top_k。</p>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.stream.busy() || !m().query.trim()"
            (click)="runStream()"
          >
            流式提问
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="上传文档" path="/api/v1/documents" [call]="calls.upload">
        <input
          type="file"
          accept=".pdf,.html,.htm,.md,.txt,.docx,.doc"
          class="text-sm file:mr-3 file:h-9 file:rounded-full file:border file:border-primary file:bg-white file:px-4 file:text-primary"
          (change)="pick($event)"
        />
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.upload.busy() || !file()"
            (click)="runUpload()"
          >
            上传并索引
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="文档列表" method="GET" path="/api/v1/documents" [call]="calls.list">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">page_size</span>
            <input
              type="number"
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.pageSize"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">page_token（可选）</span>
            <input
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.pageToken"
            />
          </label>
        </div>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.list.busy()"
            (click)="runList()"
          >
            查询
          </button>
        </div>
      </app-endpoint>

      <app-endpoint
        title="文档详情 / 删除"
        method="GET"
        path="/api/v1/documents/{id}  ·  DELETE 同路径"
        [call]="calls.doc"
      >
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">文档 id</span>
          <input class="h-11 rounded-xl border border-hairline px-3.5" [formField]="f.docId" />
        </label>
        <div class="flex gap-3">
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.doc.busy() || !m().docId.trim()"
            (click)="calls.doc.run(getDoc)"
          >
            查询
          </button>
          <button
            class="h-11 rounded-full border border-primary px-5 text-primary active:scale-95 disabled:opacity-40"
            [disabled]="calls.doc.busy() || !m().docId.trim()"
            (click)="calls.doc.run(deleteDoc)"
          >
            删除
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="导出向量" path="/api/v1/documents:exportVectors" [call]="calls.export">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">collection（可选）</span>
            <input
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.collection"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">limit</span>
            <input
              type="number"
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.exportLimit"
            />
          </label>
        </div>
        <p class="text-sm text-muted">
          响应只展示前 {{ previewPoints }} 个点、每个向量前 {{ previewDims }} 维。
        </p>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.export.busy()"
            (click)="runExport()"
          >
            导出
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="抓取网页" path="/api/v1/webpages:scrape" [call]="calls.scrape">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">url</span>
          <input class="h-11 rounded-xl border border-hairline px-3.5" [formField]="f.url" />
        </label>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.scrape.busy() || !m().url.trim()"
            (click)="calls.scrape.run(scrape)"
          >
            抓取
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="批量抓取" path="/api/v1/webpages:crawl" [call]="calls.crawl">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">urls（每行一个，最多 50 个）</span>
          <textarea
            class="min-h-24 rounded-xl border border-hairline px-3.5 py-2.5"
            [formField]="f.urls"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-semibold text-ink-80">max_depth（1–3）</span>
          <input
            type="number"
            class="h-11 rounded-xl border border-hairline px-3.5"
            [formField]="f.maxDepth"
          />
        </label>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.crawl.busy() || !crawlUrls().length"
            (click)="calls.crawl.run(crawl)"
          >
            批量抓取
          </button>
        </div>
      </app-endpoint>

      <app-endpoint
        title="数据同步"
        [path]="'/api/v1/' + m().syncTarget + ':sync'"
        [call]="calls.sync"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">资源</span>
            <select
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.syncTarget"
            >
              <option value="posts">posts</option>
              <option value="comments">comments</option>
              <option value="resources">resources（全部）</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">limit</span>
            <input
              type="number"
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.syncLimit"
            />
          </label>
        </div>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="calls.sync.busy()"
            (click)="calls.sync.run(sync)"
          >
            同步
          </button>
        </div>
      </app-endpoint>
    </app-module-page>
  `,
})
export class RagPage {
  protected readonly previewPoints = PREVIEW_POINTS;
  protected readonly previewDims = PREVIEW_DIMS;
  protected readonly m = signal({
    query: '这个项目包含哪些模块？',
    collection: '',
    topK: 5,
    pageSize: 20,
    pageToken: '',
    docId: '',
    exportLimit: 2000,
    url: 'https://example.com',
    urls: 'https://example.com',
    maxDepth: 1,
    syncTarget: 'posts' as SyncTarget,
    syncLimit: 1000,
  });
  protected readonly f = form(this.m);
  protected readonly file = signal<File | null>(null);
  protected readonly calls = {
    collections: new Call(),
    query: new Call(),
    stream: new Call<string>(),
    upload: new Call(),
    list: new Call(),
    doc: new Call(),
    export: new Call(),
    scrape: new Call(),
    crawl: new Call(),
    sync: new Call(),
  };

  protected readonly listCollections = () => ragCollections();
  protected readonly getDoc = () => ragGetDocument(this.m().docId.trim());
  protected readonly deleteDoc = () => ragDeleteDocument(this.m().docId.trim());
  protected readonly scrape = () => ragScrape(this.m().url.trim());
  protected readonly crawl = () => ragCrawl(this.crawlUrls(), this.m().maxDepth);
  protected readonly sync = () => ragSync(this.m().syncTarget, this.m().syncLimit);

  protected crawlUrls(): string[] {
    return this.m()
      .urls.split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
  }

  private queryBody() {
    const m = this.m();
    return { query: m.query.trim(), collection: m.collection.trim() || undefined, top_k: m.topK };
  }

  protected pick(e: Event): void {
    this.file.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected runQuery(): Promise<void> {
    return this.calls.query.run(() => ragQuery(this.queryBody()));
  }

  protected runStream(): Promise<void> {
    return this.calls.stream.run(async (set) => {
      let answer = '';
      await ragStreamQuery(this.queryBody(), (token) => set((answer += token)));
      return answer;
    });
  }

  protected runUpload(): Promise<void> {
    return this.calls.upload.run(() => ragUpload(this.file()!));
  }

  protected runList(): Promise<void> {
    const m = this.m();
    return this.calls.list.run(() => ragListDocuments(m.pageSize, m.pageToken.trim()));
  }

  protected runExport(): Promise<void> {
    const m = this.m();
    return this.calls.export.run(async () => {
      const r = await ragExportVectors(m.collection.trim(), m.exportLimit);
      return {
        dimension: r.dimension,
        total: r.points.length,
        points: r.points.slice(0, PREVIEW_POINTS).map((p) => ({
          ...p,
          vector: p.vector.slice(0, PREVIEW_DIMS),
        })),
      };
    });
  }
}

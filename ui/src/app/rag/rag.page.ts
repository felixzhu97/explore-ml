import { Component, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { Call } from '../shared/call';
import { Endpoint } from '../shared/endpoint';
import { FilePick } from '../shared/file-pick';
import { ModulePage } from '../shared/module-page';
import { RagService, type SyncTarget } from './rag.service';

const PREVIEW_POINTS = 20;
const PREVIEW_DIMENSIONS = 8;

@Component({
  selector: 'app-rag-page',
  imports: [
    Endpoint,
    FilePick,
    FormField,
    ModulePage,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
  ],
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
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.collections.busy()"
            (click)="calls.collections.run(listCollections)"
          >
            查询
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="问答" path="/api/v1/documents:query" [call]="calls.query">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-caption font-semibold text-ink-80">问题</span>
            <textarea nz-input rows="3" [formField]="requestForm.query"></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">collection（可选）</span>
            <input nz-input [formField]="requestForm.collection" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">top_k（1–20）</span>
            <nz-input-number class="w-full" [nzMin]="1" [formField]="requestForm.topK" />
          </label>
        </div>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.query.busy()"
            [disabled]="!formModel().query.trim()"
            (click)="runQuery()"
          >
            提问
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="流式问答" path="/api/v1/documents:streamQuery" [call]="calls.stream">
        <p class="m-0 text-caption text-muted">使用上方「问答」的问题、集合与 top_k。</p>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.stream.busy()"
            [disabled]="!formModel().query.trim()"
            (click)="runStream()"
          >
            流式提问
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="上传文档" path="/api/v1/documents" [call]="calls.upload">
        <app-file-pick accept=".pdf,.html,.htm,.md,.txt,.docx,.doc" (picked)="file.set($event)" />
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.upload.busy()"
            [disabled]="!file()"
            (click)="runUpload()"
          >
            上传并索引
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="文档列表" method="GET" path="/api/v1/documents" [call]="calls.list">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">page_size</span>
            <nz-input-number class="w-full" [nzMin]="1" [formField]="requestForm.pageSize" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">page_token（可选）</span>
            <input nz-input [formField]="requestForm.pageToken" />
          </label>
        </div>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.list.busy()"
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
        [call]="calls.document"
      >
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">文档 id</span>
          <input nz-input [formField]="requestForm.documentId" />
        </label>
        <div class="flex gap-3">
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.document.busy()"
            [disabled]="!formModel().documentId.trim()"
            (click)="calls.document.run(getDocument)"
          >
            查询
          </button>
          <button
            nz-button
            nzShape="round"
            [disabled]="calls.document.busy() || !formModel().documentId.trim()"
            (click)="calls.document.run(deleteDocument)"
          >
            删除
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="导出向量" path="/api/v1/documents:exportVectors" [call]="calls.export">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">collection（可选）</span>
            <input nz-input [formField]="requestForm.collection" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">limit</span>
            <nz-input-number class="w-full" [nzMin]="1" [formField]="requestForm.exportLimit" />
          </label>
        </div>
        <p class="m-0 text-caption text-muted">
          响应只展示前 {{ previewPoints }} 个点、每个向量前 {{ previewDimensions }} 维。
        </p>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.export.busy()"
            (click)="runExport()"
          >
            导出
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="抓取网页" path="/api/v1/webpages:scrape" [call]="calls.scrape">
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">url</span>
          <input nz-input [formField]="requestForm.url" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.scrape.busy()"
            [disabled]="!formModel().url.trim()"
            (click)="calls.scrape.run(scrape)"
          >
            抓取
          </button>
        </div>
      </app-endpoint>

      <app-endpoint title="批量抓取" path="/api/v1/webpages:crawl" [call]="calls.crawl">
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">urls（每行一个，最多 50 个）</span>
          <textarea nz-input rows="3" [formField]="requestForm.urls"></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-caption font-semibold text-ink-80">max_depth（1–3）</span>
          <nz-input-number class="w-full" [nzMin]="1" [formField]="requestForm.maxDepth" />
        </label>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.crawl.busy()"
            [disabled]="!crawlUrls().length"
            (click)="calls.crawl.run(crawl)"
          >
            批量抓取
          </button>
        </div>
      </app-endpoint>

      <app-endpoint
        title="数据同步"
        [path]="'/api/v1/' + formModel().syncTarget + ':sync'"
        [call]="calls.sync"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">资源</span>
            <nz-select [formField]="requestForm.syncTarget">
              <nz-option nzValue="posts" nzLabel="posts" />
              <nz-option nzValue="comments" nzLabel="comments" />
              <nz-option nzValue="resources" nzLabel="resources（全部）" />
            </nz-select>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">limit</span>
            <nz-input-number class="w-full" [nzMin]="1" [formField]="requestForm.syncLimit" />
          </label>
        </div>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="calls.sync.busy()"
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
  private readonly ragService = inject(RagService);
  protected readonly previewPoints = PREVIEW_POINTS;
  protected readonly previewDimensions = PREVIEW_DIMENSIONS;
  protected readonly formModel = signal({
    query: '这个项目包含哪些模块？',
    collection: '',
    topK: 5,
    pageSize: 20,
    pageToken: '',
    documentId: '',
    exportLimit: 2000,
    url: 'https://example.com',
    urls: 'https://example.com',
    maxDepth: 1,
    syncTarget: 'posts' as SyncTarget,
    syncLimit: 1000,
  });
  protected readonly requestForm = form(this.formModel);
  protected readonly file = signal<File | null>(null);
  protected readonly calls = {
    collections: new Call(),
    query: new Call(),
    stream: new Call<string>(),
    upload: new Call(),
    list: new Call(),
    document: new Call(),
    export: new Call(),
    scrape: new Call(),
    crawl: new Call(),
    sync: new Call(),
  };

  protected readonly listCollections = () => this.ragService.listCollections();
  protected readonly getDocument = () =>
    this.ragService.getDocument(this.formModel().documentId.trim());
  protected readonly deleteDocument = () =>
    this.ragService.deleteDocument(this.formModel().documentId.trim());
  protected readonly scrape = () => this.ragService.scrapeWebpage(this.formModel().url.trim());
  protected readonly crawl = () =>
    this.ragService.crawlWebpages(this.crawlUrls(), this.formModel().maxDepth);
  protected readonly sync = () =>
    this.ragService.sync(this.formModel().syncTarget, this.formModel().syncLimit);

  protected crawlUrls(): string[] {
    return this.formModel()
      .urls.split('\n')
      .map((url) => url.trim())
      .filter(Boolean);
  }

  private queryRequest() {
    const values = this.formModel();
    return {
      query: values.query.trim(),
      collection: values.collection.trim() || undefined,
      top_k: values.topK,
    };
  }

  protected runQuery(): Promise<void> {
    return this.calls.query.run(() => this.ragService.query(this.queryRequest()));
  }

  protected runStream(): Promise<void> {
    return this.calls.stream.run(async (setValue) => {
      let answer = '';
      await this.ragService.streamQuery(this.queryRequest(), (token) =>
        setValue((answer += token)),
      );
      return answer;
    });
  }

  protected runUpload(): Promise<void> {
    return this.calls.upload.run(() => this.ragService.uploadDocument(this.file()!));
  }

  protected runList(): Promise<void> {
    const values = this.formModel();
    return this.calls.list.run(() =>
      this.ragService.listDocuments(values.pageSize, values.pageToken.trim()),
    );
  }

  protected runExport(): Promise<void> {
    const values = this.formModel();
    return this.calls.export.run(async () => {
      const exported = await this.ragService.exportVectors(
        values.collection.trim(),
        values.exportLimit,
      );
      return {
        dimension: exported.dimension,
        total: exported.points.length,
        points: exported.points.slice(0, PREVIEW_POINTS).map((point) => ({
          ...point,
          vector: point.vector.slice(0, PREVIEW_DIMENSIONS),
        })),
      };
    });
  }
}

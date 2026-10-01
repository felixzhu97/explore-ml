import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import * as d3 from 'd3';
import { BarChart } from '../shared/bar-chart';
import { Call } from '../shared/call';
import { groupCounts, pca2, sourceLabel, truncate, type Point } from '../shared/chart-math';
import { LineChart } from '../shared/line-chart';
import { ScatterChart, type ScatterPoint } from '../shared/scatter-chart';
import { Endpoint } from '../shared/endpoint';
import { FilePick } from '../shared/file-pick';
import { ModulePage } from '../shared/module-page';
import {
  RagService,
  type CollectionInfo,
  type ExportedPoint,
  type QueryResponse,
  type SyncTarget,
} from './rag.service';

const PREVIEW_POINTS = 20;
const PREVIEW_DIMENSIONS = 8;
const MAX_LEGEND_GROUPS = 12;
const OTHER_GROUP = '其他';
const LABEL_LENGTH = 14;

type AtlasGrouping = 'type' | 'document';

function groupKey(point: ExportedPoint, grouping: AtlasGrouping): string {
  if (grouping === 'document') return sourceLabel(point.metadata);
  const type = point.metadata?.['source_type'];
  return typeof type === 'string' && type ? type : '未知类型';
}

@Component({
  selector: 'app-rag-page',
  imports: [
    BarChart,
    Endpoint,
    FilePick,
    FormField,
    LineChart,
    ModulePage,
    ScatterChart,
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
        @if (collectionBars().length) {
          <app-bar-chart
            [data]="collectionBars()"
            [format]="formatCount"
            emptyLabel="—"
            ariaLabel="各集合的向量点数"
          />
        }
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
        @if (sourceBars().length) {
          <section class="flex flex-col gap-2">
            <h3 class="m-0 text-caption font-semibold text-ink-80">
              来源相关度 · 检索 {{ calls.query.value()?.total_chunks_searched }} 个分块 · 生成
              {{ calls.query.value()?.generation_time_ms }} ms
            </h3>
            <app-bar-chart [data]="sourceBars()" ariaLabel="检索来源相关度分数" />
          </section>
        }
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
        @if (arrivals().length) {
          <section class="flex flex-col gap-2">
            <h3 class="m-0 text-caption font-semibold text-ink-80">
              令牌到达 · {{ arrivals().length }} 个事件 · 首字 {{ firstTokenMs() }} ms ·
              {{ charsPerSecond() }} 字/秒
            </h3>
            <app-line-chart
              [series]="streamSeries()"
              [xMin]="0"
              [markers]="[{ value: firstTokenMs(), label: '首字' }]"
              curve="step"
              [xFormat]="formatMs"
              [yFormat]="formatCount"
              ariaLabel="流式回答累计字数随时间变化"
            />
          </section>
        }
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
        @if (atlasPoints().length) {
          <section class="flex flex-col gap-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="m-0 text-caption font-semibold text-ink-80">
                向量地图 · PCA 二维投影 · {{ atlasPoints().length }} 个点 · 解释方差
                {{ formatPercent(projection().explained[0]) }} /
                {{ formatPercent(projection().explained[1]) }}
              </h3>
              <div class="flex gap-2">
                @for (option of groupingOptions; track option.value) {
                  <button
                    nz-button
                    nzSize="small"
                    nzShape="round"
                    [nzType]="grouping() === option.value ? 'primary' : 'default'"
                    (click)="setGrouping(option.value)"
                  >
                    {{ option.label }}
                  </button>
                }
                <button nz-button nzSize="small" nzShape="round" (click)="atlas.resetZoom()">
                  重置缩放
                </button>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (group of legend(); track group.key) {
                <button
                  nz-button
                  nzSize="small"
                  nzShape="round"
                  [nzType]="highlight() === group.key ? 'primary' : 'default'"
                  (click)="toggleHighlight(group.key)"
                >
                  {{ group.key }} · {{ group.count }}
                </button>
              }
            </div>
            <app-scatter-chart
              #atlas
              [points]="atlasPoints()"
              [groups]="atlasGroups()"
              [highlight]="highlight()"
              ariaLabel="导出向量的二维投影"
            />
            <p class="m-0 text-fine text-muted">
              滚轮缩放、拖动平移，悬停查看分块文本；点击图例高亮一组。
            </p>
          </section>
        }
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
    collections: new Call<CollectionInfo[]>(),
    query: new Call<QueryResponse>(),
    stream: new Call<string>(),
    upload: new Call(),
    list: new Call(),
    document: new Call(),
    export: new Call(),
    scrape: new Call(),
    crawl: new Call(),
    sync: new Call(),
  };

  protected readonly arrivals = signal<Point[]>([]);
  protected readonly exported = signal<ExportedPoint[]>([]);
  protected readonly grouping = signal<AtlasGrouping>('type');
  protected readonly groupingOptions = [
    { value: 'type', label: '按类型' },
    { value: 'document', label: '按文档' },
  ] as const;
  protected readonly highlight = signal<string | null>(null);
  protected readonly formatCount = d3.format(',');
  protected readonly formatPercent = d3.format('.0%');
  protected readonly formatMs = (milliseconds: number) => `${Math.round(milliseconds)} ms`;

  protected readonly collectionBars = computed(() =>
    (this.calls.collections.value() ?? []).map((collection) => ({
      label: collection.name,
      value: collection.points_count ?? collection.vectors_count ?? null,
    })),
  );
  protected readonly sourceBars = computed(() =>
    (this.calls.query.value()?.sources ?? []).map((source, index) => ({
      label: `${index + 1}. ${truncate(sourceLabel(source.metadata), LABEL_LENGTH)}`,
      value: source.score,
    })),
  );
  protected readonly streamSeries = computed(() => [
    { label: '累计字数', points: [{ x: 0, y: 0 }, ...this.arrivals()] },
  ]);
  protected readonly firstTokenMs = computed(() => Math.round(this.arrivals()[0]?.x ?? 0));
  protected readonly charsPerSecond = computed(() => {
    const last = this.arrivals().at(-1);
    return last && last.x > 0 ? Math.round((last.y / last.x) * 1000) : 0;
  });
  protected readonly projection = computed(() =>
    pca2(this.exported().map((point) => point.vector)),
  );
  private readonly groupKeys = computed(() =>
    this.exported().map((point) => groupKey(point, this.grouping())),
  );
  protected readonly legend = computed(() => {
    const counts = groupCounts(this.groupKeys());
    if (counts.length <= MAX_LEGEND_GROUPS) return counts;
    const kept = counts.slice(0, MAX_LEGEND_GROUPS - 1);
    const rest = counts
      .slice(MAX_LEGEND_GROUPS - 1)
      .reduce((total, group) => total + group.count, 0);
    return [...kept, { key: OTHER_GROUP, count: rest }];
  });
  protected readonly atlasGroups = computed(() => this.legend().map((group) => group.key));
  protected readonly atlasPoints = computed((): ScatterPoint[] => {
    const known = new Set(this.atlasGroups());
    const keys = this.groupKeys();
    const { coordinates } = this.projection();
    return this.exported().map((point, index) => ({
      id: point.id,
      x: coordinates[index]?.[0] ?? 0,
      y: coordinates[index]?.[1] ?? 0,
      group: known.has(keys[index]) ? keys[index] : OTHER_GROUP,
      label: sourceLabel(point.metadata),
      detail: truncate(point.text ?? '', 160),
    }));
  });

  protected setGrouping(grouping: AtlasGrouping): void {
    this.grouping.set(grouping);
    this.highlight.set(null);
  }

  protected toggleHighlight(group: string): void {
    this.highlight.update((current) => (current === group ? null : group));
  }

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
    this.arrivals.set([]);
    return this.calls.stream.run(async (setValue) => {
      let answer = '';
      const startedAt = performance.now();
      await this.ragService.streamQuery(this.queryRequest(), (token) => {
        answer += token;
        const arrival = { x: performance.now() - startedAt, y: answer.length };
        this.arrivals.update((arrivals) => [...arrivals, arrival]);
        setValue(answer);
      });
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
      this.highlight.set(null);
      this.exported.set(exported.points);
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

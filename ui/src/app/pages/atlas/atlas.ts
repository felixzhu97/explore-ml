import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  EmbeddingView,
  createNNDescent,
  createUMAP,
  type DataPoint,
  type NNDescentResult,
  type Rectangle,
  type UMAP,
} from 'embedding-atlas';
import { ragQuery } from '../../core/api/clients';
import {
  CATEGORY_COLORS,
  MAX_BROWSER_POINTS,
  categorize,
  collectionOf,
  exportVectors,
  keywordLabel,
  nearestPoint,
  pointsInRects,
  samplePoints,
  splitXY,
  toMatrix,
  type AtlasPoint,
} from '../../core/atlas';
import { errorMessage } from '../../core/http';
import { MarkersOverlay, type Marker } from './markers-overlay';

const NEIGHBORS = 8;
const VIEW_HEIGHT = 600;

interface Neighbor {
  index: number;
  distance: number;
}

@Component({
  selector: 'app-atlas',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './atlas.html',
  styleUrl: './atlas.css',
})
export class Atlas {
  /** Optional `?q=&collection=` from the RAG playground. */
  readonly q = input<string>();
  readonly collection = input<string>();

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('map');

  protected readonly model = signal({ query: '', collection: '' });
  protected readonly f = form(this.model);
  protected readonly status = signal('');
  protected readonly error = signal('');
  protected readonly sampled = signal<{ shown: number; total: number } | null>(null);
  protected readonly collections = signal<string[]>([]);
  protected readonly points = signal<AtlasPoint[]>([]);
  protected readonly hits = signal<{ index: number; score: number }[]>([]);
  protected readonly selected = signal<number | null>(null);
  protected readonly neighbors = signal<Neighbor[]>([]);
  protected readonly legend = signal<{ name: string; color: string }[]>([]);
  protected readonly selectedPoint = computed(() => {
    const i = this.selected();
    return i == null ? null : this.points()[i];
  });

  private all: AtlasPoint[] = [];
  private dimension = 0;
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private view?: EmbeddingView;
  private umap?: UMAP;
  private index?: NNDescentResult;
  private runId = 0;

  constructor() {
    afterNextRender(() => {
      this.model.set({ query: this.q() ?? '', collection: this.collection() ?? '' });
      void this.load();
    });
    inject(DestroyRef).onDestroy(() => {
      this.runId++;
      this.view?.destroy();
      this.umap?.destroy();
      this.index?.destroy();
    });
  }

  protected collectionName(p: AtlasPoint): string {
    return collectionOf(p);
  }

  protected async load(): Promise<void> {
    this.error.set('');
    this.status.set('拉取向量…');
    try {
      const res = await exportVectors(undefined, 10000);
      this.all = res.points;
      this.dimension = res.dimension;
      this.collections.set([...new Set(res.points.map(collectionOf))].sort());
      await this.project();
    } catch (e) {
      this.status.set('');
      this.error.set(errorMessage(e));
    }
  }

  protected async project(): Promise<void> {
    const run = ++this.runId;
    const filter = this.model().collection;
    const pool = filter ? this.all.filter((p) => collectionOf(p) === filter) : this.all;
    const { points, sampled } = samplePoints(pool, MAX_BROWSER_POINTS);
    this.sampled.set(sampled ? { shown: points.length, total: pool.length } : null);
    this.points.set(points);
    this.hits.set([]);
    this.selected.set(null);
    this.neighbors.set([]);
    this.view?.update({ selection: null, tooltip: null });
    this.umap?.destroy();
    this.index?.destroy();
    this.umap = this.index = undefined;

    if (points.length < 3 || !this.dimension) {
      this.status.set(points.length ? '点数太少，无法降维' : '向量库为空，先在 RAG 调试台上传文档');
      return;
    }

    const count = points.length;
    const data = toMatrix(points, this.dimension);
    const { names, codes } = categorize(points);
    this.legend.set(
      names.map((name, i) => ({ name, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] })),
    );

    this.status.set(`UMAP 降维中（${count} 点）…`);
    const umap = await createUMAP(count, this.dimension, 2, data, { metric: 'cosine' });
    if (run !== this.runId) return umap.destroy();
    this.umap = umap;

    let done = false;
    const finished = umap.run().then(() => (done = true));
    const tick = () => {
      if (run !== this.runId) return;
      this.render(codes, names.length);
      if (!done) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await finished;
    if (run !== this.runId) return;
    this.render(codes, names.length);

    this.status.set('构建近邻索引…');
    const index = await createNNDescent(count, this.dimension, data, { metric: 'cosine' });
    if (run !== this.runId) return index.destroy();
    this.index = index;
    this.status.set('');
    if (this.model().query.trim()) void this.search();
  }

  private render(codes: Uint8Array<ArrayBuffer>, categories: number): void {
    if (!this.umap) return;
    const { x, y } = splitXY(this.umap.embedding, codes.length);
    this.x = x;
    this.y = y;
    const props = {
      data: { x, y, category: codes },
      categoryColors: CATEGORY_COLORS.slice(0, Math.max(1, categories)),
      width: this.container().nativeElement.clientWidth || 800,
      height: VIEW_HEIGHT,
      config: { mode: 'density' as const, colorScheme: 'light' as const },
      theme: { fontFamily: 'system-ui, -apple-system, sans-serif', brandingLink: null },
      querySelection: (px: number, py: number, unit: number) =>
        Promise.resolve(this.dataPoint(nearestPoint(this.x, this.y, px, py, unit * 8))),
      queryClusterLabels: (clusters: Rectangle[][]) =>
        Promise.resolve(
          clusters.map((rects) =>
            keywordLabel(pointsInRects(this.x, this.y, rects).map((i) => this.points()[i].text)),
          ),
        ),
      onSelection: (sel: DataPoint[] | null) => this.select(sel?.[0]),
      customOverlay: { class: MarkersOverlay, props: { markers: this.markers() } },
    };
    if (this.view) this.view.update(props);
    else this.view = new EmbeddingView(this.container().nativeElement, props);
  }

  private dataPoint(i: number): DataPoint | null {
    if (i < 0) return null;
    const p = this.points()[i];
    return { x: this.x[i], y: this.y[i], text: p.text, identifier: i };
  }

  private markers(): Marker[] {
    return this.hits().map((h, n) => ({ x: this.x[h.index], y: this.y[h.index], n: n + 1 }));
  }

  private select(point: DataPoint | undefined): void {
    const i = point?.identifier == null ? null : Number(point.identifier);
    this.selected.set(i);
    if (i == null || !this.index) {
      this.neighbors.set([]);
      return;
    }
    const { indices, distances } = this.index.queryByIndex(i, NEIGHBORS + 1);
    this.neighbors.set(
      Array.from(indices)
        .map((index, k) => ({ index, distance: distances[k] }))
        .filter((n) => n.index !== i && n.index >= 0)
        .slice(0, NEIGHBORS),
    );
  }

  protected async search(): Promise<void> {
    const { query, collection } = this.model();
    if (!query.trim()) return;
    this.error.set('');
    try {
      const res = await ragQuery({
        query: query.trim(),
        collection: collection || undefined,
        top_k: 10,
      });
      const byId = new Map(this.points().map((p, i) => [p.id, i]));
      this.hits.set(
        res.sources
          .map((s) => ({ index: byId.get(s.id) ?? -1, score: s.score }))
          .filter((h) => h.index >= 0),
      );
      if (res.sources.length && !this.hits().length) {
        this.error.set('命中的来源不在当前地图中（可能被集合筛选或抽样排除）');
      }
      this.view?.update({
        selection: this.hits().map((h) => this.dataPoint(h.index)!),
        customOverlay: { class: MarkersOverlay, props: { markers: this.markers() } },
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected focus(index: number): void {
    const p = this.dataPoint(index);
    if (!p) return;
    this.view?.update({ selection: [p] });
    this.select(p);
  }
}

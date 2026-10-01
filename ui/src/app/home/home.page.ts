import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { BarChart } from '../shared/bar-chart';
import { appendSamples, type Series } from '../shared/chart-math';
import {
  HealthService,
  STATUS_LABELS,
  badgeStatus,
  type HealthReport,
  type ModuleHealth,
} from '../shared/health';
import { HELPERS } from '../shared/helpers';
import { LineChart } from '../shared/line-chart';

const REFRESH_INTERVAL_MS = 15_000;
const HISTORY_CAPACITY = 40;
const ROUND_TRIP = '往返';

@Component({
  selector: 'app-home',
  imports: [BarChart, LineChart, NzBadgeModule, NzButtonModule, NzCardModule, RouterLink],
  template: `
    <div class="mx-auto flex max-w-page flex-col gap-6 px-6 py-12">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-2">
          <h1 class="m-0 font-display text-display-lg font-semibold">Explore ML</h1>
          <p class="m-0 text-muted">
            {{ upCount() }} /
            {{ helpers.length }} 个模块在线。每个模块一个页面，可直接测试全部接口。
          </p>
        </div>
        <button nz-button nzShape="round" [nzLoading]="checking()" (click)="refresh()">
          重新检查
        </button>
      </header>

      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (helper of helpers; track helper.id) {
          @let health = result(helper.id);
          <li>
            <a class="block h-full" [routerLink]="'/' + helper.id">
              <nz-card nzHoverable class="h-full">
                <div class="flex flex-col gap-1">
                  <span class="font-display text-tagline font-semibold text-ink">{{
                    helper.name
                  }}</span>
                  <span class="text-caption text-muted">python_ml/{{ helper.module }}</span>
                  <nz-badge
                    [nzStatus]="health ? badgeStatus(health.status) : 'processing'"
                    [nzText]="
                      health
                        ? statusLabels[health.status] + (health.detail ? ' · ' + health.detail : '')
                        : '检查中…'
                    "
                  />
                  @let trend = moduleTrend(helper.module);
                  @if (trend.points.length > 1) {
                    <app-line-chart
                      [series]="[trend]"
                      [compact]="true"
                      [height]="36"
                      [ariaLabel]="helper.name + ' 健康检查耗时趋势'"
                    />
                  }
                </div>
              </nz-card>
            </a>
          </li>
        }
      </ul>

      <section class="flex flex-col gap-3 rounded-lg bg-parchment p-6">
        <h2 class="m-0 font-display text-tagline font-semibold">往返延迟</h2>
        <p class="m-0 text-caption text-muted">
          浏览器到 GET /health 的耗时，每 15 秒采样一次（页面可见时）。
        </p>
        @if (roundTrip().points.length) {
          <app-line-chart
            [series]="[roundTrip()]"
            [highlights]="roundTrip().points.slice(-1)"
            [xFormat]="formatSeconds"
            [yFormat]="formatLatency"
            ariaLabel="往返延迟趋势"
          />
        }
      </section>

      <section class="flex flex-col gap-3 rounded-lg bg-parchment p-6">
        <h2 class="m-0 font-display text-tagline font-semibold">模块自检耗时</h2>
        <p class="m-0 text-caption text-muted">服务端执行各模块 health() 的耗时（latency_ms）。</p>
        <app-bar-chart
          [data]="latency()"
          [format]="formatLatency"
          emptyLabel="—"
          ariaLabel="各模块自检耗时"
        />
      </section>
    </div>
  `,
})
export class Home {
  private readonly healthService = inject(HealthService);
  private readonly startedAt = performance.now();
  protected readonly helpers = HELPERS;
  protected readonly report = signal<HealthReport | undefined>(undefined);
  protected readonly history = signal<Series[]>([]);
  protected readonly checking = signal(false);
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly badgeStatus = badgeStatus;
  protected readonly upCount = computed(
    () => this.report()?.modules.filter((health) => health.status === 'ok').length ?? 0,
  );
  protected readonly latency = computed(() =>
    HELPERS.map((helper) => ({
      label: helper.name,
      value: this.result(helper.id)?.latencyMs ?? null,
    })),
  );
  protected readonly roundTrip = computed(() => this.trend(ROUND_TRIP));
  protected readonly formatLatency = (latencyMs: number) => `${latencyMs} ms`;
  protected readonly formatSeconds = (seconds: number) => `${Math.round(seconds)}s`;

  constructor() {
    void this.refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void this.refresh();
    }, REFRESH_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected result(id: string): ModuleHealth | undefined {
    return this.report()?.modules.find((health) => health.helper.id === id);
  }

  protected moduleTrend(module: string): Series {
    return this.trend(module);
  }

  protected async refresh(): Promise<void> {
    this.checking.set(true);
    const report = await this.healthService.check();
    const seconds = (performance.now() - this.startedAt) / 1000;
    const samples: Record<string, number | null> = { [ROUND_TRIP]: report.roundTripMs };
    for (const health of report.modules) samples[health.helper.module] = health.latencyMs;
    this.history.update((history) => appendSamples(history, seconds, samples, HISTORY_CAPACITY));
    this.report.set(report);
    this.checking.set(false);
  }

  private trend(label: string): Series {
    return this.history().find((series) => series.label === label) ?? { label, points: [] };
  }
}

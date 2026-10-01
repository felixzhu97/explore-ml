import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { BarChart } from '../shared/bar-chart';
import {
  HealthService,
  STATUS_LABELS,
  badgeStatus,
  type HealthReport,
  type ModuleHealth,
} from '../shared/health';
import { HELPERS } from '../shared/helpers';

@Component({
  selector: 'app-home',
  imports: [BarChart, NzBadgeModule, NzButtonModule, NzCardModule, RouterLink],
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
                </div>
              </nz-card>
            </a>
          </li>
        }
      </ul>

      <section class="flex flex-col gap-3 rounded-lg bg-parchment p-6">
        <h2 class="m-0 font-display text-tagline font-semibold">健康检查延迟</h2>
        <app-bar-chart
          [data]="latency()"
          [format]="formatLatency"
          emptyLabel="离线"
          ariaLabel="各模块延迟"
        />
      </section>
    </div>
  `,
})
export class Home {
  private readonly healthService = inject(HealthService);
  protected readonly helpers = HELPERS;
  protected readonly report = signal<HealthReport | undefined>(undefined);
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
  protected readonly formatLatency = (latencyMs: number) => `${latencyMs} ms`;

  constructor() {
    void this.refresh();
  }

  protected result(id: string): ModuleHealth | undefined {
    return this.report()?.modules.find((health) => health.helper.id === id);
  }

  protected async refresh(): Promise<void> {
    this.checking.set(true);
    this.report.set(await this.healthService.check());
    this.checking.set(false);
  }
}

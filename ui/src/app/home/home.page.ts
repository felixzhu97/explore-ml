import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { BarChart } from '../shared/bar-chart';
import { checkAll, type HealthResult } from '../shared/health';
import { SERVICES } from '../shared/services';

@Component({
  selector: 'app-home',
  imports: [BarChart, NzBadgeModule, NzButtonModule, NzCardModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-page flex-col gap-6 px-6 py-12">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-2">
          <h1 class="m-0 font-display text-display-lg font-semibold">Explore ML</h1>
          <p class="m-0 text-muted">
            {{ upCount() }} /
            {{ services.length }} 个模块在线。每个模块一个页面，可直接测试全部接口。
          </p>
        </div>
        <button nz-button nzShape="round" [nzLoading]="checking()" (click)="refresh()">
          重新检查
        </button>
      </header>

      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (s of services; track s.id) {
          @let r = result(s.id);
          <li>
            <a class="block h-full" [routerLink]="'/' + s.id">
              <nz-card nzHoverable class="h-full">
                <div class="flex flex-col gap-1">
                  <span class="font-display text-tagline font-semibold text-ink">{{ s.name }}</span>
                  <span class="text-caption text-muted">python_ml/{{ s.dir }} · {{ s.port }}</span>
                  <nz-badge
                    [nzStatus]="r ? (r.ok ? 'success' : 'default') : 'processing'"
                    [nzText]="r ? (r.ok ? '在线' : '离线 · ' + r.detail) : '检查中…'"
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
          [format]="formatMs"
          emptyLabel="离线"
          ariaLabel="各模块延迟"
        />
      </section>
    </div>
  `,
})
export class Home {
  protected readonly services = SERVICES;
  protected readonly results = signal<HealthResult[]>([]);
  protected readonly checking = signal(false);
  protected readonly upCount = computed(() => this.results().filter((r) => r.ok).length);
  protected readonly latency = computed(() =>
    SERVICES.map((s) => {
      const r = this.result(s.id);
      return { label: s.name, value: r?.ok ? r.latencyMs : null };
    }),
  );
  protected readonly formatMs = (v: number) => `${v} ms`;

  constructor() {
    void this.refresh();
  }

  protected result(id: string): HealthResult | undefined {
    return this.results().find((r) => r.service.id === id);
  }

  protected async refresh(): Promise<void> {
    this.checking.set(true);
    this.results.set(await checkAll());
    this.checking.set(false);
  }
}

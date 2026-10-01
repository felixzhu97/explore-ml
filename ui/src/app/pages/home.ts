import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BarChart } from '../charts/bar-chart';
import { checkAll, type HealthResult } from '../core/health';
import { SERVICES } from '../core/services';

@Component({
  selector: 'app-home',
  imports: [BarChart, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-[980px] flex-col gap-6 px-6 py-12">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-2">
          <h1 class="font-display text-[40px] leading-[1.1] font-semibold tracking-[-0.28px]">
            Explore ML
          </h1>
          <p class="text-muted">
            {{ upCount() }} /
            {{ services.length }} 个模块在线。每个模块一个页面，可直接测试全部接口。
          </p>
        </div>
        <button
          class="h-11 rounded-full border border-primary px-5 text-primary active:scale-95 disabled:opacity-40"
          [disabled]="checking()"
          (click)="refresh()"
        >
          {{ checking() ? '检查中…' : '重新检查' }}
        </button>
      </header>

      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (s of services; track s.id) {
          @let r = result(s.id);
          <li>
            <a
              class="flex h-full flex-col gap-1 rounded-2xl border border-hairline p-6 hover:border-primary"
              [routerLink]="'/' + s.id"
            >
              <span class="flex items-center gap-2">
                <span
                  class="inline-block size-2 rounded-full"
                  [class]="r?.ok ? 'bg-primary' : 'bg-muted'"
                ></span>
                <span class="font-display text-[21px] font-semibold">{{ s.name }}</span>
              </span>
              <span class="text-sm text-muted">python_ml/{{ s.dir }} · {{ s.port }}</span>
              <span class="text-sm">{{
                r ? (r.ok ? '在线' : '离线 · ' + r.detail) : '检查中…'
              }}</span>
            </a>
          </li>
        }
      </ul>

      <section class="flex flex-col gap-3 rounded-2xl bg-parchment p-6">
        <h2 class="font-display text-[21px] font-semibold">健康检查延迟</h2>
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

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BarChart } from '../../charts/bar-chart';
import { checkAll, type HealthResult } from '../../core/health';
import { SERVICES, svcUrl, type ServiceId } from '../../core/services';

@Component({
  selector: 'app-overview',
  imports: [BarChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview {
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

  protected result(id: ServiceId): HealthResult | undefined {
    return this.results().find((r) => r.service.id === id);
  }

  protected docsUrl(id: ServiceId): string {
    return svcUrl(id, '/docs');
  }

  protected async refresh(): Promise<void> {
    this.checking.set(true);
    this.results.set(await checkAll());
    this.checking.set(false);
  }
}

import { Component, computed, inject, input, type OnInit } from '@angular/core';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { Call } from './call';
import { HealthService, STATUS_LABELS, badgeStatus, type HealthReport } from './health';
import { findHelper, mlUrl, type HelperId } from './helpers';

/** Page frame for one module: name, package, health check and the endpoint list. */
@Component({
  selector: 'app-module-page',
  imports: [NzBadgeModule, NzButtonModule],
  template: `
    @let currentHelper = helper();
    <div class="mx-auto flex max-w-page flex-col gap-6 px-6 py-12">
      <header class="flex flex-col gap-3">
        <h1 class="m-0 font-display text-display-lg font-semibold">
          {{ currentHelper.name }}
        </h1>
        <p class="m-0 text-caption text-muted">
          python_ml/{{ currentHelper.module }} · 端口 8000 · 代理 /ml ·
          <a [href]="docsUrl" target="_blank">OpenAPI</a>
        </p>
        <div class="flex items-center gap-4">
          <button nz-button nzShape="round" [nzLoading]="healthCall.busy()" (click)="check()">
            健康检查
          </button>
          @let health = moduleHealth();
          @if (health) {
            <nz-badge
              [nzStatus]="badgeStatus(health.status)"
              [nzText]="
                statusLabels[health.status] +
                ' · GET /health' +
                (health.latencyMs !== null ? ' · ' + health.latencyMs + ' ms' : '') +
                (health.detail ? ' · ' + health.detail : '')
              "
            />
          }
        </div>
      </header>
      <ng-content />
    </div>
  `,
})
export class ModulePage implements OnInit {
  readonly module = input.required<HelperId>();
  private readonly healthService = inject(HealthService);
  protected readonly helper = computed(() => findHelper(this.module())!);
  protected readonly healthCall = new Call<HealthReport>();
  protected readonly moduleHealth = computed(() =>
    this.healthCall.value()?.modules.find((health) => health.helper.id === this.module()),
  );
  protected readonly docsUrl = mlUrl('/docs');
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly badgeStatus = badgeStatus;

  ngOnInit(): void {
    void this.check();
  }

  protected check(): Promise<void> {
    return this.healthCall.run(() => this.healthService.check());
  }
}

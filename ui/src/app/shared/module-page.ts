import { Component, computed, inject, input, type OnInit } from '@angular/core';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { Call } from './call';
import { HealthService, type HealthResult } from './health';
import { findHelper, helperUrl, type HelperId } from './helpers';

/** Page frame for one helper module: name, port, health check and the endpoint list. */
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
          python_ml/{{ currentHelper.directory }} · 端口 {{ currentHelper.port }} · 代理 /svc/{{
            currentHelper.id
          }}
          ·
          <a [href]="docsUrl()" target="_blank">OpenAPI</a>
        </p>
        <div class="flex items-center gap-4">
          <button nz-button nzShape="round" [nzLoading]="healthCall.busy()" (click)="check()">
            健康检查
          </button>
          @let health = healthCall.value();
          @if (health) {
            <nz-badge
              [nzStatus]="health.ok ? 'success' : 'default'"
              [nzText]="
                (health.ok ? '在线' : '离线') +
                ' · GET ' +
                currentHelper.healthPath +
                (health.latencyMs !== null ? ' · ' + health.latencyMs + ' ms' : '')
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
  protected readonly docsUrl = computed(() => helperUrl(this.module(), '/docs'));
  protected readonly healthCall = new Call<HealthResult>();

  ngOnInit(): void {
    void this.check();
  }

  protected check(): Promise<void> {
    return this.healthCall.run(() => this.healthService.check(this.helper()));
  }
}

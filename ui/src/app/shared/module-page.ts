import { ChangeDetectionStrategy, Component, computed, input, type OnInit } from '@angular/core';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { Call } from '../shared/call';
import { checkHealth } from '../shared/health';
import { getService, svcUrl, type ServiceId } from '../shared/services';

/** Page frame for one helper module: name, port, health check and the endpoint list. */
@Component({
  selector: 'app-module-page',
  imports: [NzBadgeModule, NzButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = service();
    <div class="mx-auto flex max-w-page flex-col gap-6 px-6 py-12">
      <header class="flex flex-col gap-3">
        <h1 class="m-0 font-display text-display-lg font-semibold">
          {{ s.name }}
        </h1>
        <p class="m-0 text-caption text-muted">
          python_ml/{{ s.dir }} · 端口 {{ s.port }} · 代理 /svc/{{ s.id }} ·
          <a [href]="docsUrl()" target="_blank">OpenAPI</a>
        </p>
        <div class="flex items-center gap-4">
          <button nz-button nzShape="round" [nzLoading]="health.busy()" (click)="check()">
            健康检查
          </button>
          @let h = health.value();
          @if (h) {
            <nz-badge
              [nzStatus]="h.ok ? 'success' : 'default'"
              [nzText]="
                (h.ok ? '在线' : '离线') +
                ' · GET ' +
                s.healthPath +
                (h.latencyMs !== null ? ' · ' + h.latencyMs + ' ms' : '')
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
  readonly module = input.required<ServiceId>();
  protected readonly service = computed(() => getService(this.module())!);
  protected readonly docsUrl = computed(() => svcUrl(this.module(), '/docs'));
  protected readonly health = new Call<Awaited<ReturnType<typeof checkHealth>>>();

  ngOnInit(): void {
    void this.check();
  }

  protected check(): Promise<void> {
    return this.health.run(() => checkHealth(this.service()));
  }
}

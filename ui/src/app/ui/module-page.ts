import { ChangeDetectionStrategy, Component, computed, input, type OnInit } from '@angular/core';
import { Call } from '../core/call';
import { checkHealth } from '../core/health';
import { getService, svcUrl, type ServiceId } from '../core/services';

/** Page frame for one helper module: name, port, health check and the endpoint list. */
@Component({
  selector: 'app-module-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = service();
    <div class="mx-auto flex max-w-[980px] flex-col gap-6 px-6 py-12">
      <header class="flex flex-col gap-2">
        <h1 class="font-display text-[40px] leading-[1.1] font-semibold tracking-[-0.28px]">
          {{ s.name }}
        </h1>
        <p class="text-sm text-muted">
          python_ml/{{ s.dir }} · 端口 {{ s.port }} · 代理 /svc/{{ s.id }} ·
          <a class="text-primary hover:underline" [href]="docsUrl()" target="_blank">OpenAPI</a>
        </p>
        <div class="flex items-center gap-3">
          <button
            class="h-11 rounded-full border border-primary px-5 text-primary active:scale-95 disabled:opacity-40"
            [disabled]="health.busy()"
            (click)="check()"
          >
            健康检查
          </button>
          @let h = health.value();
          @if (h) {
            <span class="text-sm">
              <span
                class="mr-1 inline-block size-2 rounded-full"
                [class]="h.ok ? 'bg-primary' : 'bg-muted'"
              ></span>
              {{ h.ok ? '在线' : '离线' }} · GET {{ s.healthPath }}
              @if (h.latencyMs !== null) {
                · {{ h.latencyMs }} ms
              }
            </span>
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

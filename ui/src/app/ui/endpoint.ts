import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import type { Call } from '../core/call';

type CallState = Pick<Call<unknown>, 'busy' | 'value' | 'error' | 'ms'>;

/** One testable endpoint: projected form controls, then status and the raw JSON response. */
@Component({
  selector: 'app-endpoint',
  imports: [JsonPipe, NzAlertModule, NzCardModule, NzTagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-card [nzTitle]="header">
      <div class="flex flex-col gap-4">
        <ng-content />
        @let c = call();
        @if (c.busy()) {
          <span><nz-tag nzColor="processing">请求中…</nz-tag></span>
        } @else if (c.ms() !== null) {
          <span>
            <nz-tag [nzColor]="c.error() ? 'error' : 'success'">
              {{ c.error() ? '失败' : '完成' }} · {{ c.ms() }} ms
            </nz-tag>
          </span>
        }
        @if (c.error()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="c.error()" />
        }
        @if (c.value() !== undefined) {
          <pre
            class="m-0 max-h-80 overflow-auto rounded-md bg-parchment p-4 font-mono text-caption"
            >{{ c.value() | json }}</pre>
        }
      </div>
    </nz-card>

    <ng-template #header>
      <div class="flex flex-col gap-1 py-1">
        <span class="font-display text-tagline font-semibold">{{ title() }}</span>
        <span class="flex items-center gap-2 font-mono text-caption font-normal text-muted">
          <nz-tag class="m-0 font-semibold">{{ method() }}</nz-tag>
          {{ path() }}
        </span>
      </div>
    </ng-template>
  `,
})
export class Endpoint {
  readonly title = input.required<string>();
  readonly method = input<'GET' | 'POST' | 'DELETE' | 'WS'>('POST');
  readonly path = input.required<string>();
  readonly call = input.required<CallState>();
}

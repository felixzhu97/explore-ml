import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Call } from '../core/call';

type CallState = Pick<Call<unknown>, 'busy' | 'value' | 'error' | 'ms'>;

/** One testable endpoint: projected form controls, then status and the raw JSON response. */
@Component({
  selector: 'app-endpoint',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 rounded-2xl border border-hairline p-6">
      <header class="flex flex-col gap-1">
        <h2 class="font-display text-[21px] font-semibold tracking-[-0.2px]">{{ title() }}</h2>
        <code class="font-mono text-sm text-muted">
          <span class="font-semibold text-ink">{{ method() }}</span> {{ path() }}
        </code>
      </header>
      <ng-content />
      @let c = call();
      @if (c.busy()) {
        <p class="text-sm text-muted">请求中…</p>
      } @else if (c.ms() !== null) {
        <p class="text-sm text-muted">{{ c.error() ? '失败' : '完成' }} · {{ c.ms() }} ms</p>
      }
      @if (c.error()) {
        <p role="alert" class="border-l-[3px] border-ink pl-3 text-sm">{{ c.error() }}</p>
      }
      @if (c.value() !== undefined) {
        <pre
          class="max-h-80 overflow-auto rounded-xl bg-parchment p-4 font-mono text-[13px] leading-5"
          >{{ c.value() | json }}</pre>
      }
    </section>
  `,
})
export class Endpoint {
  readonly title = input.required<string>();
  readonly method = input<'GET' | 'POST' | 'DELETE' | 'WS'>('POST');
  readonly path = input.required<string>();
  readonly call = input.required<CallState>();
}

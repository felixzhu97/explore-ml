import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { BarChart } from '../charts/bar-chart';
import { rank, recall, type RankSurface, type RankedItem } from '../core/api/clients';
import { Call } from '../core/call';
import { Endpoint } from '../ui/endpoint';
import { ModulePage } from '../ui/module-page';

function splitIds(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toBars(items: RankedItem[] | undefined) {
  return (items ?? []).slice(0, 20).map((i) => ({ label: i.id, value: i.score }));
}

@Component({
  selector: 'app-rec-page',
  imports: [BarChart, Endpoint, FormField, ModulePage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="rec">
      <app-endpoint title="排序" [path]="'/api/v1/' + m().surface + ':rank'" [call]="rankCall">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">场景</span>
            <select class="h-11 rounded-xl border border-hairline px-3.5" [formField]="f.surface">
              <option value="feeds">feeds</option>
              <option value="explores">explores</option>
              <option value="reels">reels</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">user_id</span>
            <input class="h-11 rounded-xl border border-hairline px-3.5" [formField]="f.userId" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-sm font-semibold text-ink-80">candidate_ids（逗号或换行分隔）</span>
            <textarea
              class="min-h-24 rounded-xl border border-hairline px-3.5 py-2.5"
              [formField]="f.candidates"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">limit</span>
            <input
              type="number"
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.limit"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">region / language（可选）</span>
            <div class="flex gap-2">
              <input
                class="h-11 min-w-0 flex-1 rounded-xl border border-hairline px-3.5"
                placeholder="CN"
                [formField]="f.region"
              />
              <input
                class="h-11 min-w-0 flex-1 rounded-xl border border-hairline px-3.5"
                placeholder="zh"
                [formField]="f.language"
              />
            </div>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">experiment_id（可选）</span>
            <input
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.experimentId"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">variant_id（可选）</span>
            <input
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.variantId"
            />
          </label>
        </div>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="rankCall.busy() || !candidateIds().length"
            (click)="runRank()"
          >
            排序
          </button>
        </div>
        @if (rankBars().length) {
          <app-bar-chart [data]="rankBars()" ariaLabel="排序分数" />
        }
      </app-endpoint>

      <app-endpoint title="召回" path="/api/v1/feeds:recall" [call]="recallCall">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">user_id</span>
            <input class="h-11 rounded-xl border border-hairline px-3.5" [formField]="f.userId" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">limit</span>
            <input
              type="number"
              class="h-11 rounded-xl border border-hairline px-3.5"
              [formField]="f.recallLimit"
            />
          </label>
        </div>
        <div>
          <button
            class="h-11 rounded-full bg-primary px-5 text-white active:scale-95 disabled:opacity-40"
            [disabled]="recallCall.busy() || !m().userId.trim()"
            (click)="runRecall()"
          >
            召回
          </button>
        </div>
        @if (recallBars().length) {
          <app-bar-chart [data]="recallBars()" ariaLabel="召回分数" />
        }
      </app-endpoint>
    </app-module-page>
  `,
})
export class RecPage {
  protected readonly m = signal({
    surface: 'feeds' as RankSurface,
    userId: 'u1',
    candidates: 'p1, p2, p3, p4, p5',
    limit: 50,
    region: '',
    language: '',
    experimentId: '',
    variantId: '',
    recallLimit: 20,
  });
  protected readonly f = form(this.m);
  protected readonly rankCall = new Call<{ items: RankedItem[] }>();
  protected readonly recallCall = new Call<{ items: RankedItem[] }>();
  protected readonly candidateIds = computed(() => splitIds(this.m().candidates));
  protected readonly rankBars = computed(() => toBars(this.rankCall.value()?.items));
  protected readonly recallBars = computed(() => toBars(this.recallCall.value()?.items));

  protected runRank(): Promise<void> {
    const m = this.m();
    return this.rankCall.run(() =>
      rank(m.surface, {
        user_id: m.userId.trim(),
        candidate_ids: this.candidateIds(),
        limit: m.limit,
        region: m.region.trim() || undefined,
        language: m.language.trim() || undefined,
        experiment_id: m.experimentId.trim() || undefined,
        variant_id: m.variantId.trim() || undefined,
      }),
    );
  }

  protected runRecall(): Promise<void> {
    const m = this.m();
    return this.recallCall.run(() => recall(m.userId.trim(), m.recallLimit));
  }
}

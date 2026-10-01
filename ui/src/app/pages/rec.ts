import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
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
  imports: [
    BarChart,
    Endpoint,
    FormField,
    ModulePage,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-module-page module="rec">
      <app-endpoint title="排序" [path]="'/api/v1/' + m().surface + ':rank'" [call]="rankCall">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">场景</span>
            <nz-select [formField]="f.surface">
              <nz-option nzValue="feeds" nzLabel="feeds" />
              <nz-option nzValue="explores" nzLabel="explores" />
              <nz-option nzValue="reels" nzLabel="reels" />
            </nz-select>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">user_id</span>
            <input nz-input [formField]="f.userId" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-sm font-semibold text-ink-80">candidate_ids（逗号或换行分隔）</span>
            <textarea nz-input rows="3" [formField]="f.candidates"></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">limit</span>
            <nz-input-number [nzMin]="1" [formField]="f.limit" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-ink-80">region（可选）</span>
              <input nz-input placeholder="CN" [formField]="f.region" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-ink-80">language（可选）</span>
              <input nz-input placeholder="zh" [formField]="f.language" />
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">experiment_id（可选）</span>
            <input nz-input [formField]="f.experimentId" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">variant_id（可选）</span>
            <input nz-input [formField]="f.variantId" />
          </label>
        </div>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="rankCall.busy()"
            [disabled]="!candidateIds().length"
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
            <input nz-input [formField]="f.userId" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink-80">limit</span>
            <nz-input-number [nzMin]="1" [formField]="f.recallLimit" />
          </label>
        </div>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="recallCall.busy()"
            [disabled]="!m().userId.trim()"
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

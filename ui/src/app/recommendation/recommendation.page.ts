import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { BarChart } from '../shared/bar-chart';
import { Call } from '../shared/call';
import { rankShifts, scoreBins } from '../shared/chart-math';
import { HistogramChart } from '../shared/histogram-chart';
import { SlopeChart } from '../shared/slope-chart';
import { Endpoint } from '../shared/endpoint';
import { ModulePage } from '../shared/module-page';
import {
  RecommendationService,
  type RankSurface,
  type RankedItem,
  type RankedItemsResponse,
} from './recommendation.service';

const MAX_CHART_BARS = 20;

function splitIds(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function toBars(items: RankedItem[] | undefined) {
  return (items ?? [])
    .slice(0, MAX_CHART_BARS)
    .map((item) => ({ label: item.id, value: item.score }));
}

@Component({
  selector: 'app-recommendation-page',
  imports: [
    BarChart,
    Endpoint,
    HistogramChart,
    SlopeChart,
    FormField,
    ModulePage,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
  ],
  template: `
    <app-module-page module="recommendation">
      <app-endpoint
        title="排序"
        [path]="'/api/v1/' + formModel().surface + ':rank'"
        [call]="rankCall"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">场景</span>
            <nz-select [formField]="requestForm.surface">
              <nz-option nzValue="feeds" nzLabel="feeds" />
              <nz-option nzValue="explores" nzLabel="explores" />
              <nz-option nzValue="reels" nzLabel="reels" />
            </nz-select>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">user_id</span>
            <input nz-input [formField]="requestForm.userId" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-caption font-semibold text-ink-80"
              >candidate_ids（逗号或换行分隔）</span
            >
            <textarea nz-input rows="3" [formField]="requestForm.candidates"></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">limit</span>
            <nz-input-number class="w-full" [nzMin]="1" [formField]="requestForm.limit" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-caption font-semibold text-ink-80">region（可选）</span>
              <input nz-input placeholder="CN" [formField]="requestForm.region" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-caption font-semibold text-ink-80">language（可选）</span>
              <input nz-input placeholder="zh" [formField]="requestForm.language" />
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">experiment_id（可选）</span>
            <input nz-input [formField]="requestForm.experimentId" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">variant_id（可选）</span>
            <input nz-input [formField]="requestForm.variantId" />
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
          <div class="grid gap-6 md:grid-cols-2">
            <section class="flex flex-col gap-2">
              <h3 class="m-0 text-caption font-semibold text-ink-80">名次变化</h3>
              <app-slope-chart [shifts]="shifts()" ariaLabel="候选输入顺序与排序结果的名次变化" />
            </section>
            <section class="flex flex-col gap-2">
              <h3 class="m-0 text-caption font-semibold text-ink-80">排序分数</h3>
              <app-bar-chart [data]="rankBars()" ariaLabel="排序分数" />
            </section>
          </div>
        }
      </app-endpoint>

      <app-endpoint title="召回" path="/api/v1/feeds:recall" [call]="recallCall">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">user_id</span>
            <input nz-input [formField]="requestForm.userId" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-caption font-semibold text-ink-80">limit</span>
            <nz-input-number class="w-full" [nzMin]="1" [formField]="requestForm.recallLimit" />
          </label>
        </div>
        <div>
          <button
            nz-button
            nzType="primary"
            nzShape="round"
            [nzLoading]="recallCall.busy()"
            [disabled]="!formModel().userId.trim()"
            (click)="runRecall()"
          >
            召回
          </button>
        </div>
        @if (recallBars().length) {
          <div class="grid gap-6 md:grid-cols-2">
            <section class="flex flex-col gap-2">
              <h3 class="m-0 text-caption font-semibold text-ink-80">
                分数分布 · {{ recallCall.value()?.items?.length }} 条
              </h3>
              <app-histogram-chart [bins]="recallBins()" ariaLabel="召回分数分布" />
            </section>
            <section class="flex flex-col gap-2">
              <h3 class="m-0 text-caption font-semibold text-ink-80">
                前 {{ recallBars().length }} 条
              </h3>
              <app-bar-chart [data]="recallBars()" ariaLabel="召回分数" />
            </section>
          </div>
        }
      </app-endpoint>
    </app-module-page>
  `,
})
export class RecommendationPage {
  private readonly recommendationService = inject(RecommendationService);
  protected readonly formModel = signal({
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
  protected readonly requestForm = form(this.formModel);
  protected readonly rankCall = new Call<RankedItemsResponse>();
  protected readonly recallCall = new Call<RankedItemsResponse>();
  protected readonly candidateIds = computed(() => splitIds(this.formModel().candidates));
  protected readonly rankBars = computed(() => toBars(this.rankCall.value()?.items));
  protected readonly recallBars = computed(() => toBars(this.recallCall.value()?.items));
  protected readonly recallBins = computed(() =>
    scoreBins((this.recallCall.value()?.items ?? []).map((item) => item.score)),
  );
  private readonly rankedCandidates = signal<string[]>([]);
  protected readonly shifts = computed(() =>
    rankShifts(this.rankedCandidates(), this.rankCall.value()?.items ?? []).slice(
      0,
      MAX_CHART_BARS,
    ),
  );

  protected runRank(): Promise<void> {
    const values = this.formModel();
    this.rankedCandidates.set(this.candidateIds());
    return this.rankCall.run(() =>
      this.recommendationService.rank(values.surface, {
        user_id: values.userId.trim(),
        candidate_ids: this.candidateIds(),
        limit: values.limit,
        region: values.region.trim() || undefined,
        language: values.language.trim() || undefined,
        experiment_id: values.experimentId.trim() || undefined,
        variant_id: values.variantId.trim() || undefined,
      }),
    );
  }

  protected runRecall(): Promise<void> {
    const values = this.formModel();
    return this.recallCall.run(() =>
      this.recommendationService.recall(values.userId.trim(), values.recallLimit),
    );
  }
}

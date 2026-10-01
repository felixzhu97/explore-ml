import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { BarChart } from '../../charts/bar-chart';
import { rank, recall, type RankSurface, type RankedItem } from '../../core/api/clients';
import { errorMessage } from '../../core/http';

@Component({
  selector: 'app-rec-playground',
  imports: [BarChart, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="row">
        <label class="field"><span>用户 ID</span><input [formField]="f.userId" /></label>
        <label class="field">
          <span>场景</span>
          <select [formField]="f.surface">
            <option value="feeds">feeds</option>
            <option value="explores">explores</option>
            <option value="reels">reels</option>
          </select>
        </label>
        <label class="field"
          ><span>数量上限</span><input type="number" [formField]="f.limit"
        /></label>
      </div>
      <div class="row">
        <label class="field"><span>地区</span><input [formField]="f.region" /></label>
        <label class="field"><span>语言</span><input [formField]="f.language" /></label>
        <label class="field"><span>实验 ID</span><input [formField]="f.experimentId" /></label>
        <label class="field"><span>分组 ID</span><input [formField]="f.variantId" /></label>
      </div>
      <label class="field">
        <span>候选 ID（逗号或空格分隔）</span>
        <textarea [formField]="f.candidates"></textarea>
      </label>
      <div class="row">
        <button class="btn btn-primary" [disabled]="busy()" (click)="run('rank')">排序</button>
        <button class="btn btn-secondary" [disabled]="busy()" (click)="run('recall')">召回</button>
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>
    @if (items().length) {
      <div class="card">
        <h3>打分结果</h3>
        <app-bar-chart [data]="bars()" ariaLabel="推荐打分" />
      </div>
    }
  `,
})
export class RecPlayground {
  private readonly model = signal({
    userId: 'u_demo',
    surface: 'feeds' as RankSurface,
    limit: 20,
    region: '',
    language: '',
    experimentId: '',
    variantId: '',
    candidates: 'p1, p2, p3, p4, p5, p6, p7, p8',
  });
  protected readonly f = form(this.model);
  protected readonly items = signal<RankedItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly bars = computed(() =>
    this.items().map((i) => ({ label: i.id, value: i.score })),
  );

  protected async run(kind: 'rank' | 'recall'): Promise<void> {
    const m = this.model();
    this.busy.set(true);
    this.error.set('');
    try {
      const res =
        kind === 'rank'
          ? await rank(m.surface, {
              user_id: m.userId,
              candidate_ids: m.candidates.split(/[\s,]+/).filter(Boolean),
              limit: m.limit,
              region: m.region || undefined,
              language: m.language || undefined,
              experiment_id: m.experimentId || undefined,
              variant_id: m.variantId || undefined,
            })
          : await recall(m.userId, m.limit);
      this.items.set(res.items);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

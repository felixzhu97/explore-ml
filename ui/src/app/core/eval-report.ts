export type Metrics = Record<string, number>;

export type Report =
  | { kind: 'recommendation'; model: Metrics; baseline?: Metrics }
  | { kind: 'vision'; top1: number; labels: string[]; confusion: number[][] }
  | { kind: 'retrieval'; metrics: Metrics }
  | { kind: 'llm'; judge: string; scores: Metrics }
  | { kind: 'speech'; model: number; baseline?: number };

export type ReportKind = Report['kind'];

export const REPORT_TITLES: Record<ReportKind, string> = {
  recommendation: '推荐排序',
  vision: '视觉分类',
  retrieval: 'RAG 检索',
  llm: 'LLM 回答质量',
  speech: '语音识别错误率',
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isMetrics = (v: unknown): v is Metrics =>
  isObj(v) && Object.keys(v).length > 0 && Object.values(v).every(isNum);
const isRetrievalKey = (k: string) => /^recall@\d+$/.test(k) || k === 'mrr';

/** Detects which eval script produced `json` and normalizes it; null when unrecognized. */
export function detectReport(json: unknown): Report | null {
  if (!isObj(json)) return null;

  if (isNum(json['top1']) && Array.isArray(json['labels']) && Array.isArray(json['confusion'])) {
    const labels = json['labels'].map(String);
    const confusion = json['confusion'] as unknown[];
    const square =
      confusion.length === labels.length &&
      confusion.every(
        (row) => Array.isArray(row) && row.length === labels.length && row.every(isNum),
      );
    return square
      ? { kind: 'vision', top1: json['top1'], labels, confusion: confusion as number[][] }
      : null;
  }

  if (isObj(json['error_rate'])) {
    const er = json['error_rate'];
    if (!isNum(er['model'])) return null;
    return {
      kind: 'speech',
      model: er['model'],
      ...(isNum(er['baseline']) ? { baseline: er['baseline'] } : {}),
    };
  }

  if (typeof json['judge'] === 'string' && isMetrics(json['mean_score'])) {
    return { kind: 'llm', judge: json['judge'], scores: json['mean_score'] };
  }

  if (isMetrics(json['model'])) {
    const baseline = json['baseline'];
    return {
      kind: 'recommendation',
      model: json['model'],
      ...(isMetrics(baseline) ? { baseline } : {}),
    };
  }

  if (isMetrics(json) && Object.keys(json).every(isRetrievalKey)) {
    return { kind: 'retrieval', metrics: json };
  }

  return null;
}

export type Verdict = '更好' | '更差' | '持平';

export function compareDelta(
  value: number,
  base: number,
  lowerIsBetter = false,
): { delta: number; verdict: Verdict } {
  const delta = value - base;
  if (Math.abs(delta) < 1e-9) return { delta: 0, verdict: '持平' };
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  return { delta, verdict: better ? '更好' : '更差' };
}

export interface LoadedReport {
  name: string;
  report: Report;
}

export interface GroupedData {
  groups: string[];
  series: string[];
  values: (number | null)[][];
}

/** Rows = groups (metrics), columns = series (models / files). */
export function toGrouped(items: readonly LoadedReport[]): GroupedData | null {
  if (!items.length) return null;
  const first = items[0].report;
  switch (first.kind) {
    case 'recommendation': {
      const series = first.baseline ? ['model', 'baseline'] : ['model'];
      const groups = Object.keys(first.model);
      return {
        groups,
        series,
        values: groups.map((g) =>
          [first.model[g], first.baseline?.[g] ?? null].slice(0, series.length),
        ),
      };
    }
    case 'retrieval': {
      const reports = items.map((i) => i.report as Extract<Report, { kind: 'retrieval' }>);
      const groups = [...new Set(reports.flatMap((r) => Object.keys(r.metrics)))];
      return {
        groups,
        series: items.map((i) => i.name),
        values: groups.map((g) => reports.map((r) => r.metrics[g] ?? null)),
      };
    }
    case 'llm':
      return {
        groups: ['mean_score'],
        series: Object.keys(first.scores),
        values: [Object.values(first.scores)],
      };
    case 'speech':
      return {
        groups: ['error_rate'],
        series: first.baseline == null ? ['model'] : ['model', 'baseline'],
        values: [first.baseline == null ? [first.model] : [first.model, first.baseline]],
      };
    default:
      return null;
  }
}

export interface DeltaRow {
  metric: string;
  label: string;
  delta: number;
  verdict: Verdict;
}

/** Every non-first series compared against the first column (`ft` vs `base`). */
export function deltas(data: GroupedData, lowerIsBetter: boolean, baseIndex: number): DeltaRow[] {
  const rows: DeltaRow[] = [];
  data.groups.forEach((metric, g) => {
    const base = data.values[g][baseIndex];
    data.series.forEach((s, i) => {
      const v = data.values[g][i];
      if (i === baseIndex || v == null || base == null) return;
      rows.push({
        metric,
        label: `${s} vs ${data.series[baseIndex]}`,
        ...compareDelta(v, base, lowerIsBetter),
      });
    });
  });
  return rows;
}

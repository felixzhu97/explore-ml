import { compareDelta, deltas, detectReport, toGrouped, type LoadedReport } from './eval-report';

const loaded = (name: string, json: unknown): LoadedReport => ({
  name,
  report: detectReport(json)!,
});

describe('detectReport', () => {
  it('should recognize eval_feed_ranker output with and without baseline', () => {
    expect(detectReport({ model: { 'recall@10': 0.4 }, baseline: { 'recall@10': 0.3 } })).toEqual({
      kind: 'recommendation',
      model: { 'recall@10': 0.4 },
      baseline: { 'recall@10': 0.3 },
    });
    expect(detectReport({ model: { 'ndcg@10': 0.2 } })).toEqual({
      kind: 'recommendation',
      model: { 'ndcg@10': 0.2 },
    });
  });

  it('should recognize eval_head output only with a square confusion matrix', () => {
    const ok = {
      top1: 0.9,
      labels: ['a', 'b'],
      confusion: [
        [9, 1],
        [0, 10],
      ],
    };
    expect(detectReport(ok)?.kind).toBe('vision');
    expect(detectReport({ ...ok, confusion: [[9, 1]] })).toBeNull();
  });

  it('should recognize eval_retrieval output as flat recall@k and mrr', () => {
    expect(detectReport({ 'recall@5': 0.6, mrr: 0.4 })).toEqual({
      kind: 'retrieval',
      metrics: { 'recall@5': 0.6, mrr: 0.4 },
    });
    expect(detectReport({ 'recall@5': 0.6, accuracy: 0.4 })).toBeNull();
  });

  it('should recognize eval_answers and eval_wer output', () => {
    expect(detectReport({ judge: 'j', mean_score: { ft: 4, base: 3 } })?.kind).toBe('llm');
    expect(detectReport({ error_rate: { model: 0.1, baseline: 0.2 } })).toEqual({
      kind: 'speech',
      model: 0.1,
      baseline: 0.2,
    });
    expect(detectReport({ error_rate: { model: 0.1 } })).toEqual({ kind: 'speech', model: 0.1 });
  });

  it('should reject unknown or malformed payloads', () => {
    expect(detectReport(null)).toBeNull();
    expect(detectReport([1, 2])).toBeNull();
    expect(detectReport({ model: { 'recall@10': 'high' } })).toBeNull();
    expect(detectReport({ error_rate: { baseline: 0.2 } })).toBeNull();
  });
});

describe('compareDelta', () => {
  it('should call a higher score better by default', () => {
    expect(compareDelta(0.5, 0.4)).toEqual({ delta: expect.closeTo(0.1), verdict: '更好' });
    expect(compareDelta(0.3, 0.4).verdict).toBe('更差');
  });

  it('should call a lower error rate better when lower is better', () => {
    expect(compareDelta(0.08, 0.11, true).verdict).toBe('更好');
    expect(compareDelta(0.2, 0.2, true)).toEqual({ delta: 0, verdict: '持平' });
  });
});

describe('toGrouped and deltas', () => {
  it('should put model before baseline and compare against baseline', () => {
    const g = toGrouped([
      loaded('r.json', { model: { 'recall@10': 0.4 }, baseline: { 'recall@10': 0.3 } }),
    ])!;
    expect(g).toEqual({
      groups: ['recall@10'],
      series: ['model', 'baseline'],
      values: [[0.4, 0.3]],
    });
    expect(deltas(g, false, 1)).toEqual([
      {
        metric: 'recall@10',
        label: 'model vs baseline',
        delta: expect.closeTo(0.1),
        verdict: '更好',
      },
    ]);
  });

  it('should compare several retrieval files against the first one', () => {
    const g = toGrouped([
      loaded('base.json', { 'recall@5': 0.6, mrr: 0.5 }),
      loaded('ft.json', { 'recall@5': 0.7, mrr: 0.45 }),
    ])!;
    expect(g.series).toEqual(['base.json', 'ft.json']);
    expect(deltas(g, false, 0).map((d) => d.verdict)).toEqual(['更好', '更差']);
  });

  it('should treat a lower WER as better', () => {
    const g = toGrouped([loaded('s.json', { error_rate: { model: 0.08, baseline: 0.11 } })])!;
    expect(deltas(g, true, 1)[0].verdict).toBe('更好');
  });

  it('should not build bars for vision reports', () => {
    expect(toGrouped([loaded('v.json', { top1: 1, labels: ['a'], confusion: [[1]] })])).toBeNull();
  });
});

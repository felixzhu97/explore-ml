import { describe, expect, it } from 'vitest';
import { confusionCells, groupedBarScales, heatScale, horizontalBarScales, textOn } from './scales';

describe('chart scales', () => {
  it('should size horizontal bars against the largest value', () => {
    const { x, y } = horizontalBarScales(
      [
        { label: 'a', value: 50 },
        { label: 'b', value: 100 },
        { label: 'c', value: null },
      ],
      200,
      30,
    );
    expect(x(100)).toBe(200);
    expect(x(50)).toBe(100);
    expect(y.domain()).toEqual(['a', 'b', 'c']);
    expect(y.range()).toEqual([0, 90]);
  });

  it('should honour an explicit max for probability bars', () => {
    const { x } = horizontalBarScales([{ label: 'cat', value: 0.25 }], 400, 30, 1);
    expect(x(0.25)).toBe(100);
  });

  it('should nest series bands inside each group', () => {
    const { x0, x1, y } = groupedBarScales(
      ['recall@10', 'ndcg@10'],
      [
        { key: 'model', color: '#0066cc' },
        { key: 'baseline', color: '#7a7a7a' },
      ],
      400,
      200,
      1,
    );
    expect(x1.range()[1]).toBeCloseTo(x0.bandwidth());
    expect(y(1)).toBe(0);
    expect(y(0)).toBe(200);
  });

  it('should flatten a confusion matrix with per-row shares', () => {
    const cells = confusionCells([
      [3, 1],
      [0, 0],
    ]);
    expect(cells).toHaveLength(4);
    expect(cells[0]).toEqual({ row: 0, col: 0, count: 3, rowShare: 0.75 });
    expect(cells[3].rowShare).toBe(0);
  });

  it('should pick readable text over heatmap cells', () => {
    const scale = heatScale(10);
    expect(textOn(scale(0))).toBe('#1d1d1f');
    expect(textOn(scale(10))).toBe('#ffffff');
  });
});

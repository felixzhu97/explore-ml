import { describe, expect, it } from 'vitest';
import { appendSamples, rankShifts, scoreBins } from './chart-math';

describe('scoreBins', () => {
  it('should count every value exactly once', () => {
    const bins = scoreBins([0.1, 0.2, 0.25, 0.9], 4);
    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(4);
    expect(bins[0].x0).toBeLessThanOrEqual(0.1);
    expect(bins.at(-1)!.x1).toBeGreaterThanOrEqual(0.9);
  });

  it('should widen the domain when every value is equal', () => {
    const bins = scoreBins([0.5, 0.5]);
    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(2);
  });

  it('should return no bins when there are no values', () => {
    expect(scoreBins([])).toEqual([]);
  });
});

describe('rankShifts', () => {
  it('should pair input position with ranked position and score', () => {
    expect(
      rankShifts(
        ['p1', 'p2', 'p3'],
        [
          { id: 'p3', score: 0.9 },
          { id: 'p1', score: 0.4 },
        ],
      ),
    ).toEqual([
      { id: 'p1', from: 0, to: 1, score: 0.4 },
      { id: 'p2', from: 1, to: null, score: null },
      { id: 'p3', from: 2, to: 0, score: 0.9 },
    ]);
  });

  it('should keep the first occurrence when a candidate repeats', () => {
    expect(rankShifts(['p1', 'p1', 'p2'], []).map((shift) => shift.from)).toEqual([0, 1]);
  });
});

describe('appendSamples', () => {
  it('should append per series and drop the oldest beyond capacity', () => {
    let history = appendSamples([], 0, { a: 1, b: null }, 2);
    history = appendSamples(history, 1, { a: 2, b: 5 }, 2);
    history = appendSamples(history, 2, { a: 3, b: 6 }, 2);
    expect(history).toEqual([
      {
        label: 'a',
        points: [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
      },
      {
        label: 'b',
        points: [
          { x: 1, y: 5 },
          { x: 2, y: 6 },
        ],
      },
    ]);
  });
});

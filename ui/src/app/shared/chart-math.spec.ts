import { describe, expect, it } from 'vitest';
import {
  appendSamples,
  flaggedPoints,
  frameSeries,
  groupCounts,
  pca2,
  rankShifts,
  scoreBins,
  sourceLabel,
  truncate,
} from './chart-math';

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

describe('frame timeline', () => {
  const frames = [
    { offset_seconds: 0, scores: { nude: 0.1, prohibited: 0.7 } },
    { offset_seconds: 1.5, scores: { nude: 0.8, prohibited: 0.2 } },
  ];

  it('should build one series per category over frame offsets', () => {
    expect(frameSeries(frames)).toEqual([
      {
        label: 'nude',
        points: [
          { x: 0, y: 0.1 },
          { x: 1.5, y: 0.8 },
        ],
      },
      {
        label: 'prohibited',
        points: [
          { x: 0, y: 0.7 },
          { x: 1.5, y: 0.2 },
        ],
      },
    ]);
  });

  it('should flag frame scores that reach their category threshold', () => {
    expect(flaggedPoints(frames, { nude: 0.8, prohibited: 0.9 })).toEqual([{ x: 1.5, y: 0.8 }]);
  });
});

describe('pca2', () => {
  it('should put the widest spread on the first component', () => {
    const vectors = [
      [-2, 0.1, 0],
      [-1, -0.1, 0],
      [0, 0, 0],
      [1, 0.1, 0],
      [2, -0.1, 0],
    ];
    const { coordinates, explained } = pca2(vectors);
    const first = coordinates.map(([x]) => Math.abs(x));
    expect(first).toEqual([2, 1, 0, 1, 2].map((value) => expect.closeTo(value, 2)));
    expect(explained[0]).toBeGreaterThan(0.99);
    expect(explained[0] + explained[1]).toBeCloseTo(1, 5);
  });

  it('should return no coordinates for no vectors', () => {
    expect(pca2([])).toEqual({ coordinates: [], explained: [0, 0] });
  });
});

describe('chunk labels', () => {
  it('should prefer title, then file name, url and document id', () => {
    expect(sourceLabel({ filename: 'a.pdf', title: ' Guide ' })).toBe('Guide');
    expect(sourceLabel({ url: 'https://x', doc_id: 'd1' })).toBe('https://x');
    expect(sourceLabel({})).toBe('未知来源');
  });

  it('should truncate long labels with an ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });

  it('should count groups most frequent first', () => {
    expect(groupCounts(['b', 'a', 'b', 'c', 'a', 'b'])).toEqual([
      { key: 'b', count: 3 },
      { key: 'a', count: 2 },
      { key: 'c', count: 1 },
    ]);
  });
});

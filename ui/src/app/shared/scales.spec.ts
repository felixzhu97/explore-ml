import { describe, expect, it } from 'vitest';
import { horizontalBarScales } from './scales';

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
});

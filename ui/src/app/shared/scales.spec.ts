import { describe, expect, it } from 'vitest';
import { horizontalBarScales } from './scales';

describe('chart scales', () => {
  it('should size horizontal bars against the largest value', () => {
    const { xScale, yScale } = horizontalBarScales(
      [
        { label: 'a', value: 50 },
        { label: 'b', value: 100 },
        { label: 'c', value: null },
      ],
      200,
      30,
    );
    expect(xScale(100)).toBe(200);
    expect(xScale(50)).toBe(100);
    expect(yScale.domain()).toEqual(['a', 'b', 'c']);
    expect(yScale.range()).toEqual([0, 90]);
  });

  it('should honour an explicit max for probability bars', () => {
    const { xScale } = horizontalBarScales([{ label: 'cat', value: 0.25 }], 400, 30, 1);
    expect(xScale(0.25)).toBe(100);
  });
});

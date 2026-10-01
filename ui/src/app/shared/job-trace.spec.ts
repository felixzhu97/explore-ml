import { describe, expect, it } from 'vitest';
import { JobTrace } from './job-trace';

describe('JobTrace', () => {
  it('should time statuses and polls from submit', () => {
    const ticks = [1000, 1500, 3000, 4200];
    const trace = new JobTrace(() => ticks.shift()!);
    trace.start();
    trace.record('pending');
    trace.record('running');
    trace.record('succeeded');

    expect(trace.polls()).toEqual([500, 2000, 3200]);
    expect(trace.segments().map((segment) => segment.status)).toEqual([
      'submitted',
      'pending',
      'running',
      'succeeded',
    ]);
  });
});

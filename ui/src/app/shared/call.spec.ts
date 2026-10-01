import { describe, expect, it } from 'vitest';
import { Call } from './call';

describe('Call', () => {
  it('should store the value and elapsed time when the request succeeds', async () => {
    const ticks = [10, 52];
    const call = new Call<number>(() => ticks.shift()!);
    await call.run(async () => 7);
    expect(call.value()).toBe(7);
    expect(call.elapsedMs()).toBe(42);
    expect(call.busy()).toBe(false);
    expect(call.error()).toBe('');
  });

  it('should keep interim values when the request pushes them through set', async () => {
    const call = new Call<string>();
    await call.run(async (setValue) => {
      setValue('你');
      setValue('你好');
    });
    expect(call.value()).toBe('你好');
  });

  it('should record the error message when the request fails', async () => {
    const call = new Call();
    await call.run(async () => {
      throw new Error('500 Qdrant down');
    });
    expect(call.error()).toBe('500 Qdrant down');
    expect(call.value()).toBeUndefined();
  });
});

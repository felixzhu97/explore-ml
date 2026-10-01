import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkHealth } from './health';
import { SERVICES } from './services';

afterEach(() => vi.unstubAllGlobals());

describe('checkHealth', () => {
  it('should report latency when the helper answers ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const ticks = [100, 142];
    const result = await checkHealth(SERVICES[0], 1000, () => ticks.shift()!);
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/rec/health');
    expect(result).toMatchObject({ ok: true, latencyMs: 42 });
  });

  it('should mark the helper offline when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const result = await checkHealth(SERVICES[2]);
    expect(result).toMatchObject({ ok: false, latencyMs: null, detail: 'TypeError' });
  });

  it('should mark the helper offline on non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })));
    const result = await checkHealth(SERVICES[1]);
    expect(result).toMatchObject({ ok: false, detail: '502' });
  });
});

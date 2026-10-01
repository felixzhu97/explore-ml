import { pollJob } from './poll';

const noSleep = () => Promise.resolve();

describe('pollJob', () => {
  it('should poll until the job succeeds and report each status', async () => {
    const statuses = ['pending', 'running', 'succeeded'];
    const seen: string[] = [];
    const job = await pollJob(async () => ({ status: statuses.shift()!, image_url: 'x' }), {
      sleep: noSleep,
      onStatus: (status) => seen.push(status),
    });
    expect(seen).toEqual(['pending', 'running', 'succeeded']);
    expect(job.image_url).toBe('x');
  });

  it('should reject with the server error when the job fails', async () => {
    await expect(
      pollJob(async () => ({ status: 'failed', error: 'CUDA OOM' }), { sleep: noSleep }),
    ).rejects.toThrow('CUDA OOM');
  });

  it('should time out when the job never finishes', async () => {
    await expect(
      pollJob(async () => ({ status: 'pending' }), {
        sleep: noSleep,
        intervalMs: 100,
        timeoutMs: 300,
      }),
    ).rejects.toThrow('任务超时');
  });

  it('should stop when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      pollJob(async () => ({ status: 'pending' }), { signal: controller.signal, sleep: noSleep }),
    ).rejects.toThrow('已取消');
  });
});

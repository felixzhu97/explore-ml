export interface JobStatus {
  status: string;
  error?: string;
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

const TERMINAL = new Set(['succeeded', 'failed']);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls an async job resource until it reaches `succeeded` or `failed`. */
export async function pollJob<T extends JobStatus>(
  fetchStatus: () => Promise<T>,
  {
    intervalMs = 1500,
    timeoutMs = 10 * 60_000,
    signal,
    onStatus,
    sleep = defaultSleep,
  }: PollOptions = {},
): Promise<T> {
  let waited = 0;
  for (;;) {
    if (signal?.aborted) throw new Error('已取消');
    const job = await fetchStatus();
    onStatus?.(job.status);
    if (TERMINAL.has(job.status)) {
      if (job.status === 'failed') throw new Error(job.error || '任务失败');
      return job;
    }
    if (waited >= timeoutMs) throw new Error('任务超时');
    await sleep(intervalMs);
    waited += intervalMs;
  }
}

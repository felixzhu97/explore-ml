import { SERVICES, svcUrl, type Service } from './services';

export interface HealthResult {
  service: Service;
  ok: boolean;
  latencyMs: number | null;
  detail: string;
}

export async function checkHealth(
  service: Service,
  timeoutMs = 3000,
  now: () => number = () => performance.now(),
): Promise<HealthResult> {
  const start = now();
  try {
    const res = await fetch(svcUrl(service.id, service.healthPath), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round(now() - start);
    const text = await res.text();
    return { service, ok: res.ok, latencyMs, detail: res.ok ? text : `${res.status}` };
  } catch (e) {
    return { service, ok: false, latencyMs: null, detail: e instanceof Error ? e.name : 'error' };
  }
}

export function checkAll(): Promise<HealthResult[]> {
  return Promise.all(SERVICES.map((s) => checkHealth(s)));
}

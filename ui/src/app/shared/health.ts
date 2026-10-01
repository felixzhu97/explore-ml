import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { HELPERS, mlUrl, type Helper } from './helpers';

/** `offline`: the app is unreachable. */
export type ModuleStatus = 'ok' | 'degraded' | 'offline';

export interface ModuleHealth {
  helper: Helper;
  status: ModuleStatus;
  latencyMs: number | null;
  detail: string;
}

export interface HealthReport {
  reachable: boolean;
  status: string;
  roundTripMs: number | null;
  modules: ModuleHealth[];
  detail: string;
}

interface HealthBody {
  status: string;
  modules: Record<string, { status: ModuleStatus; latency_ms: number; [field: string]: unknown }>;
}

/** Maps `GET /health` (`{status, modules: {name: {status, latency_ms, ...}}}`) onto every helper. */
export function parseHealthReport(body: HealthBody, roundTripMs: number): HealthReport {
  const modules = HELPERS.map((helper): ModuleHealth => {
    const { status, latency_ms: latencyMs, ...rest } = body.modules[helper.module];
    return { helper, status, latencyMs, detail: describe(rest) };
  });
  return { reachable: true, status: body.status, roundTripMs, modules, detail: '' };
}

export function offlineReport(detail: string): HealthReport {
  return {
    reachable: false,
    status: 'offline',
    roundTripMs: null,
    modules: HELPERS.map((helper) => ({ helper, status: 'offline', latencyMs: null, detail })),
    detail,
  };
}

function describe(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

@Service()
export class HealthService {
  private readonly http = inject(HttpClient);

  async check(clock = () => performance.now()): Promise<HealthReport> {
    const startedAt = clock();
    try {
      const body = await firstValueFrom(
        this.http.get<HealthBody>(mlUrl('/health')).pipe(timeout(5000)),
      );
      return parseHealthReport(body, Math.round(clock() - startedAt));
    } catch (error) {
      return offlineReport(
        error instanceof HttpErrorResponse && error.status ? `${error.status}` : '网络错误',
      );
    }
  }
}

export const STATUS_LABELS: Record<ModuleStatus, string> = {
  ok: '在线',
  degraded: '降级',
  offline: '离线',
};

export function badgeStatus(status: ModuleStatus): 'success' | 'warning' | 'default' {
  if (status === 'ok') return 'success';
  if (status === 'degraded') return 'warning';
  return 'default';
}

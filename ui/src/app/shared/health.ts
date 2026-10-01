import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { HELPERS, mlUrl, type Helper } from './helpers';

export const HEALTH_PATH = '/health';

/** `disabled`: the app runs without this module (`EXPLORE_MODULES`); `offline`: app unreachable. */
export type ModuleStatus = 'ok' | 'degraded' | 'error' | 'disabled' | 'offline';

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

export interface HealthCheckOptions {
  timeoutMs?: number;
  clock?: () => number;
}

interface HealthBody {
  status?: string;
  modules?: Record<string, Record<string, unknown>>;
}

const KNOWN_STATUSES = new Set<ModuleStatus>(['ok', 'degraded', 'error']);

/** Maps `GET /health` (`{status, modules: {name: {status, latency_ms, ...}}}`) onto every helper. */
export function parseHealthReport(body: HealthBody, roundTripMs: number): HealthReport {
  const modules = HELPERS.map((helper): ModuleHealth => {
    const report = body.modules?.[helper.module];
    if (!report) return { helper, status: 'disabled', latencyMs: null, detail: '未启用' };
    const { status, latency_ms: latencyMs, ...rest } = report;
    return {
      helper,
      status: KNOWN_STATUSES.has(status as ModuleStatus) ? (status as ModuleStatus) : 'error',
      latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      detail: describe(rest),
    };
  });
  return {
    reachable: true,
    status: body.status ?? 'ok',
    roundTripMs,
    modules,
    detail: '',
  };
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
    .filter(([, value]) => value === null || typeof value !== 'object')
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

@Service()
export class HealthService {
  private readonly http = inject(HttpClient);

  async check({
    timeoutMs = 5000,
    clock = () => performance.now(),
  }: HealthCheckOptions = {}): Promise<HealthReport> {
    const startedAt = clock();
    try {
      const body = await firstValueFrom(
        this.http.get<HealthBody>(mlUrl(HEALTH_PATH)).pipe(timeout(timeoutMs)),
      );
      return parseHealthReport(body, Math.round(clock() - startedAt));
    } catch (error) {
      return offlineReport(failureDetail(error));
    }
  }
}

function failureDetail(error: unknown): string {
  if (error instanceof HttpErrorResponse) return error.status ? `${error.status}` : '网络错误';
  return error instanceof Error ? error.name : 'error';
}

export const STATUS_LABELS: Record<ModuleStatus, string> = {
  ok: '在线',
  degraded: '降级',
  error: '错误',
  disabled: '未启用',
  offline: '离线',
};

export function badgeStatus(status: ModuleStatus): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'ok') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'error') return 'error';
  return 'default';
}

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { HELPERS, helperUrl, type Helper } from './helpers';

const DETAIL_MAX_LENGTH = 160;

export interface HealthResult {
  helper: Helper;
  ok: boolean;
  latencyMs: number | null;
  detail: string;
}

export interface HealthCheckOptions {
  timeoutMs?: number;
  clock?: () => number;
}

@Service()
export class HealthService {
  private readonly http = inject(HttpClient);

  async check(
    helper: Helper,
    { timeoutMs = 3000, clock = () => performance.now() }: HealthCheckOptions = {},
  ): Promise<HealthResult> {
    const startedAt = clock();
    try {
      const body = await firstValueFrom(
        this.http
          .get(helperUrl(helper.id, helper.healthPath), { responseType: 'text' })
          .pipe(timeout(timeoutMs)),
      );
      const latencyMs = Math.round(clock() - startedAt);
      return { helper, ok: true, latencyMs, detail: body.slice(0, DETAIL_MAX_LENGTH) };
    } catch (error) {
      return { helper, ok: false, latencyMs: null, detail: failureDetail(error) };
    }
  }

  checkAll(): Promise<HealthResult[]> {
    return Promise.all(HELPERS.map((helper) => this.check(helper)));
  }
}

function failureDetail(error: unknown): string {
  if (error instanceof HttpErrorResponse) return error.status ? `${error.status}` : '网络错误';
  return error instanceof Error ? error.name : 'error';
}

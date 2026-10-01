import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HealthService, badgeStatus, parseHealthReport } from './health';
import { HELPERS } from './helpers';

describe('parseHealthReport', () => {
  it('should map module reports onto helpers by package name', () => {
    const report = parseHealthReport(
      {
        status: 'degraded',
        modules: {
          image_playground: { status: 'ok', latency_ms: 1.5, backend: 'local', lora: false },
          rag: { status: 'degraded', latency_ms: 30, qdrant: true, embeddings: false },
          recommendation: { status: 'ok', latency_ms: 0 },
          vision: { status: 'ok', latency_ms: 0 },
          speech: { status: 'ok', latency_ms: 0 },
          video: { status: 'ok', latency_ms: 0 },
        },
      },
      42,
    );
    const image = report.modules.find((health) => health.helper.id === 'image')!;
    const rag = report.modules.find((health) => health.helper.id === 'rag')!;

    expect(report).toMatchObject({ reachable: true, status: 'degraded', roundTripMs: 42 });
    expect(image).toMatchObject({
      status: 'ok',
      latencyMs: 1.5,
      detail: 'backend: local · lora: false',
    });
    expect(rag).toMatchObject({
      status: 'degraded',
      latencyMs: 30,
      detail: 'qdrant: true · embeddings: false',
    });
  });

  it('should map statuses to badge colours', () => {
    expect((['ok', 'degraded', 'offline'] as const).map((status) => badgeStatus(status))).toEqual([
      'success',
      'warning',
      'default',
    ]);
  });
});

describe('HealthService', () => {
  let service: HealthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HealthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should report round trip time when the app answers', async () => {
    const ticks = [100, 142];
    const checked = service.check(() => ticks.shift()!);
    httpTesting.expectOne('/ml/health').flush({
      status: 'ok',
      modules: Object.fromEntries(
        HELPERS.map((helper) => [helper.module, { status: 'ok', latency_ms: 2 }]),
      ),
    });
    expect(await checked).toMatchObject({ reachable: true, roundTripMs: 42 });
  });

  it('should mark every module offline when the network fails', async () => {
    const checked = service.check();
    httpTesting.expectOne('/ml/health').error(new ProgressEvent('error'));
    const report = await checked;
    expect(report).toMatchObject({ reachable: false, detail: '网络错误' });
    expect(report.modules.every((health) => health.status === 'offline')).toBe(true);
  });

  it('should mark every module offline on non-2xx status', async () => {
    const checked = service.check();
    httpTesting.expectOne('/ml/health').flush('', { status: 502, statusText: 'Bad Gateway' });
    expect(await checked).toMatchObject({ reachable: false, detail: '502' });
  });
});

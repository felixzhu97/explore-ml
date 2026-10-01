import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HealthService, badgeStatus, parseHealthReport } from './health';

describe('parseHealthReport', () => {
  it('should map module reports onto helpers by package name', () => {
    const report = parseHealthReport(
      {
        status: 'degraded',
        modules: {
          image_playground: { status: 'ok', latency_ms: 1.5, backend: 'local', lora: false },
          rag: { status: 'degraded', latency_ms: 30, services: { ollama: 'down' } },
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
    expect(rag).toMatchObject({ status: 'degraded', latencyMs: 30, detail: '' });
  });

  it('should mark a module disabled when the app does not serve it', () => {
    const report = parseHealthReport({ status: 'ok', modules: {} }, 5);
    expect(report.modules.every((health) => health.status === 'disabled')).toBe(true);
  });

  it('should treat an unknown module status as an error', () => {
    const report = parseHealthReport({ modules: { video: { status: 'weird' } } }, 5);
    expect(report.modules.find((health) => health.helper.id === 'video')?.status).toBe('error');
  });

  it('should map statuses to badge colours', () => {
    expect(
      ['ok', 'degraded', 'error', 'offline'].map((status) => badgeStatus(status as never)),
    ).toEqual(['success', 'warning', 'error', 'default']);
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
    const checked = service.check({ clock: () => ticks.shift()! });
    httpTesting
      .expectOne('/ml/health')
      .flush({ status: 'ok', modules: { vision: { status: 'ok', latency_ms: 2 } } });
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

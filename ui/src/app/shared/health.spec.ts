import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HealthService } from './health';
import { findHelper } from './helpers';

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

  it('should report latency when the helper answers ok', async () => {
    const ticks = [100, 142];
    const checked = service.check(findHelper('recommendation')!, { clock: () => ticks.shift()! });
    httpTesting.expectOne('/svc/recommendation/health').flush('{"status":"ok"}');
    expect(await checked).toMatchObject({ ok: true, latencyMs: 42, detail: '{"status":"ok"}' });
  });

  it('should mark the helper offline when the network fails', async () => {
    const checked = service.check(findHelper('rag')!);
    httpTesting.expectOne('/svc/rag/health/ready').error(new ProgressEvent('error'));
    expect(await checked).toMatchObject({ ok: false, latencyMs: null, detail: '网络错误' });
  });

  it('should mark the helper offline on non-2xx status', async () => {
    const checked = service.check(findHelper('vision')!);
    httpTesting
      .expectOne('/svc/vision/health')
      .flush('', { status: 502, statusText: 'Bad Gateway' });
    expect(await checked).toMatchObject({ ok: false, detail: '502' });
  });
});

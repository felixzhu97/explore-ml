import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ImageService } from './image.service';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('ImageService', () => {
  let service: ImageService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ImageService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should create an image job, poll it and map the url onto the proxy', async () => {
    const generated = service.generate('cat', '', { sleep: () => Promise.resolve() });
    const createRequest = httpTesting.expectOne('/ml/api/v1/images:generate');
    expect(createRequest.request.body).toEqual({ prompt: 'cat', negative_prompt: undefined });
    createRequest.flush({ job_id: 'job-1' });
    await flushMicrotasks();
    httpTesting.expectOne('/ml/api/v1/imageJobs/job-1').flush({ status: 'pending' });
    await flushMicrotasks();
    httpTesting.expectOne('/ml/api/v1/imageJobs/job-1').flush({
      status: 'succeeded',
      image_url: 'http://localhost:8003/output/image/job-1.png',
    });
    expect((await generated).url).toBe('/ml/output/image/job-1.png');
  });
});

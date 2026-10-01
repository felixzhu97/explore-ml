import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VisionService } from './vision.service';

describe('VisionService', () => {
  let service: VisionService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VisionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should send video urls under video_url for moderation', async () => {
    const moderated = service.moderateVideo({ url: 'http://x/v.mp4' });
    const request = httpTesting.expectOne('/ml/api/v1/videos:moderate');
    expect(request.request.body).toEqual({ video_url: 'http://x/v.mp4' });
    request.flush({ safe: true, categories: [] });
    expect((await moderated).safe).toBe(true);
  });

  it('should upload image files as multipart form data', async () => {
    const file = new File(['pixels'], 'cat.jpg', { type: 'image/jpeg' });
    const predicted = service.predictImage({ file });
    const request = httpTesting.expectOne('/ml/api/v1/images:predict');
    expect((request.request.body as FormData).get('file')).toBeInstanceOf(File);
    request.flush({ labels: ['tabby'] });
    expect((await predicted).labels).toEqual(['tabby']);
  });
});

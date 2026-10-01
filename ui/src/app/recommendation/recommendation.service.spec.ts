import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RecommendationService } from './recommendation.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecommendationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should post rank requests to the surface custom method', async () => {
    const ranked = service.rank('reels', { user_id: 'u', candidate_ids: ['p1'] });
    const request = httpTesting.expectOne('/svc/recommendation/api/v1/reels:rank');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ user_id: 'u', candidate_ids: ['p1'] });
    request.flush({ items: [{ id: 'p1', score: 0.9 }] });
    expect((await ranked).items[0].score).toBe(0.9);
  });

  it('should send the user id as user_id when recalling feeds', async () => {
    const recalled = service.recall('u1', 5);
    const request = httpTesting.expectOne('/svc/recommendation/api/v1/feeds:recall');
    expect(request.request.body).toEqual({ user_id: 'u1', limit: 5 });
    request.flush({ items: [] });
    expect((await recalled).items).toEqual([]);
  });
});

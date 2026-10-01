import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SpeechService } from './speech.service';

describe('SpeechService', () => {
  let service: SpeechService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SpeechService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should map synthesized audio urls onto the proxy', async () => {
    const synthesized = service.synthesize('hi');
    httpTesting
      .expectOne('/svc/speech/api/v1/voices:synthesize')
      .flush({ audio_url: 'http://localhost:8004/output/voice/a.mp3' });
    expect(await synthesized).toBe('/svc/speech/output/voice/a.mp3');
  });
});

import { json } from '../shared/test-fetch';
import { synthesize } from './speech.api';

afterEach(() => vi.unstubAllGlobals());

describe('speech api', () => {
  it('should map synthesized audio urls onto the proxy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ audio_url: 'http://localhost:8004/output/voice/a.mp3' })),
    );
    expect(await synthesize('hi')).toBe('/svc/speech/output/voice/a.mp3');
  });
});

import { json } from '../shared/test-fetch';
import { moderateVideo } from './vision.api';

afterEach(() => vi.unstubAllGlobals());

describe('vision api', () => {
  it('should send video urls under video_url for moderation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ safe: true, categories: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await moderateVideo({ url: 'http://x/v.mp4' });
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/vision/api/v1/videos:moderate');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ video_url: 'http://x/v.mp4' });
  });
});

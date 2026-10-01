import { json } from '../shared/test-fetch';
import { generateImage } from './image.api';

afterEach(() => vi.unstubAllGlobals());

describe('image api', () => {
  it('should create an image job, poll it and map the url onto the proxy', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ job_id: 'job-1' }))
      .mockResolvedValueOnce(json({ status: 'pending' }))
      .mockResolvedValueOnce(
        json({ status: 'succeeded', image_url: 'http://localhost:8003/output/image/job-1.png' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const res = await generateImage('cat', '', { sleep: () => Promise.resolve() });
    expect(fetchMock.mock.calls[1][0]).toBe('/svc/image/api/v1/imageJobs/job-1');
    expect(res.url).toBe('/svc/image/output/image/job-1.png');
  });
});

import {
  generateImage,
  moderateVideo,
  ragQuery,
  ragStreamQuery,
  rank,
  synthesize,
} from './clients';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('helper clients', () => {
  it('should post rank requests to the surface custom method', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ items: [{ id: 'p1', score: 0.9 }] }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await rank('reels', { user_id: 'u', candidate_ids: ['p1'] });
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/rec/api/v1/reels:rank');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      user_id: 'u',
      candidate_ids: ['p1'],
    });
    expect(res.items[0].score).toBe(0.9);
  });

  it('should surface FastAPI detail messages on errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'Qdrant down' }, 500)));
    await expect(ragQuery({ query: 'q' })).rejects.toThrow('500 Qdrant down');
  });

  it('should send video urls under video_url for moderation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ safe: true, categories: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await moderateVideo({ url: 'http://x/v.mp4' });
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/vision/api/v1/videos:moderate');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ video_url: 'http://x/v.mp4' });
  });

  it('should stream RAG tokens from the SSE endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('data: 你\n\ndata: 好\n\ndata: [DONE]\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );
    let answer = '';
    await ragStreamQuery({ query: 'q' }, (t) => (answer += t));
    expect(answer).toBe('你好');
  });

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

  it('should map synthesized audio urls onto the proxy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ audio_url: 'http://localhost:8004/output/voice/a.mp3' })),
    );
    expect(await synthesize('hi')).toBe('/svc/speech/output/voice/a.mp3');
  });
});

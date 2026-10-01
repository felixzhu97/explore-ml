import { json } from '../shared/test-fetch';
import { rank } from './rec.api';

afterEach(() => vi.unstubAllGlobals());

describe('rec api', () => {
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
});

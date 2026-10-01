import {
  categorize,
  exportVectors,
  keywordLabel,
  nearestPoint,
  pointsInRects,
  samplePoints,
  splitXY,
  toMatrix,
  type AtlasPoint,
} from './atlas';

const point = (id: string, collection: string, vector = [1, 2, 3]): AtlasPoint => ({
  id,
  vector,
  text: id,
  metadata: { collection },
});

afterEach(() => vi.unstubAllGlobals());

describe('atlas data prep', () => {
  it('should keep every point when under the browser budget', () => {
    const res = samplePoints([1, 2, 3], 5);
    expect(res).toEqual({ points: [1, 2, 3], sampled: false });
  });

  it('should sample deterministically and flag it when over budget', () => {
    const all = Array.from({ length: 100 }, (_, i) => i);
    const a = samplePoints(all, 10);
    const b = samplePoints(all, 10);
    expect(a.sampled).toBe(true);
    expect(a.points).toHaveLength(10);
    expect(a.points).toEqual(b.points);
    expect(new Set(a.points).size).toBe(10);
  });

  it('should pack vectors row-major into a Float32Array', () => {
    const m = toMatrix([point('a', 'd', [1, 2]), point('b', 'd', [3, 4])], 2);
    expect(Array.from(m)).toEqual([1, 2, 3, 4]);
  });

  it('should code collections in first-seen order', () => {
    const { names, codes } = categorize([
      point('a', 'posts'),
      point('b', 'docs'),
      point('c', 'posts'),
    ]);
    expect(names).toEqual(['posts', 'docs']);
    expect(Array.from(codes)).toEqual([0, 1, 0]);
  });

  it('should split interleaved UMAP output into x and y', () => {
    const { x, y } = splitXY(new Float32Array([1, 2, 3, 4]), 2);
    expect(Array.from(x)).toEqual([1, 3]);
    expect(Array.from(y)).toEqual([2, 4]);
  });

  it('should find points inside cluster rectangles', () => {
    const x = new Float32Array([0, 5, 10]);
    const y = new Float32Array([0, 5, 10]);
    expect(pointsInRects(x, y, [{ xMin: -1, yMin: -1, xMax: 6, yMax: 6 }])).toEqual([0, 1]);
  });

  it('should label clusters by their most frequent terms', () => {
    expect(
      keywordLabel(['Qdrant vector search', 'vector index in Qdrant', 'the vector of 2024']),
    ).toBe('vector · qdrant');
    expect(keywordLabel(['the of and'])).toBeNull();
  });

  it('should pick the nearest point within the hit radius', () => {
    const x = new Float32Array([0, 10]);
    const y = new Float32Array([0, 10]);
    expect(nearestPoint(x, y, 9, 9, 3)).toBe(1);
    expect(nearestPoint(x, y, 5, 5, 1)).toBe(-1);
  });

  it('should request vector export from the RAG helper', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ dimension: 0, points: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await exportVectors('posts', 500);
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/rag/api/v1/documents:exportVectors');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      collection: 'posts',
      limit: 500,
    });
  });
});

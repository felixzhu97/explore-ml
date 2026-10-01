import { json } from '../shared/test-fetch';
import { ragDeleteDocument, ragExportVectors, ragQuery, ragStreamQuery, ragSync } from './rag.api';

afterEach(() => vi.unstubAllGlobals());

describe('rag api', () => {
  it('should surface FastAPI detail messages on errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'Qdrant down' }, 500)));
    await expect(ragQuery({ query: 'q' })).rejects.toThrow('500 Qdrant down');
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

  it('should delete a RAG document and tolerate the empty 204 body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await ragDeleteDocument('doc 1')).toEqual({ status: 204 });
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/rag/api/v1/documents/doc%201');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('should omit an empty collection when exporting vectors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ dimension: 0, points: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await ragExportVectors('', 100);
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/rag/api/v1/documents:exportVectors');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ limit: 100 });
  });

  it('should send an empty body when syncing all resources', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal('fetch', fetchMock);
    await ragSync('resources');
    expect(fetchMock.mock.calls[0][0]).toBe('/svc/rag/api/v1/resources:sync');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
  });
});

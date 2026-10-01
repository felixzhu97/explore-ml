import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { errorMessage } from '../shared/error-message';
import { RagService } from './rag.service';

describe('RagService', () => {
  let service: RagService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RagService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.unstubAllGlobals();
  });

  it('should surface FastAPI detail messages on errors', async () => {
    const answered = service.query({ query: 'q' });
    httpTesting
      .expectOne('/svc/rag/api/v1/documents:query')
      .flush({ detail: 'Qdrant down' }, { status: 500, statusText: 'Server Error' });
    const failure = await answered.catch((error: unknown) => error);
    expect(errorMessage(failure)).toBe('500 Qdrant down');
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
    await service.streamQuery({ query: 'q' }, (token) => (answer += token));
    expect(answer).toBe('你好');
  });

  it('should delete a RAG document and tolerate the empty 204 body', async () => {
    const deleted = service.deleteDocument('doc 1');
    const request = httpTesting.expectOne('/svc/rag/api/v1/documents/doc%201');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(await deleted).toEqual({ status: 204 });
  });

  it('should send the page size and token as query parameters', async () => {
    const listed = service.listDocuments(10, 'next');
    const request = httpTesting.expectOne((pending) => pending.url === '/svc/rag/api/v1/documents');
    expect(request.request.params.get('page_size')).toBe('10');
    expect(request.request.params.get('page_token')).toBe('next');
    request.flush({ documents: [] });
    expect((await listed).documents).toEqual([]);
  });

  it('should omit an empty collection when exporting vectors', async () => {
    const exported = service.exportVectors('', 100);
    const request = httpTesting.expectOne('/svc/rag/api/v1/documents:exportVectors');
    expect(JSON.parse(JSON.stringify(request.request.body))).toEqual({ limit: 100 });
    request.flush({ dimension: 0, points: [] });
    await exported;
  });

  it('should send an empty body when syncing all resources', async () => {
    const synced = service.sync('resources');
    const request = httpTesting.expectOne('/svc/rag/api/v1/resources:sync');
    expect(request.request.body).toEqual({});
    request.flush({});
    await synced;
  });
});

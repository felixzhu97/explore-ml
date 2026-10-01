import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { mlUrl } from '../shared/helpers';
import { readSse } from '../shared/sse';

export interface QueryRequest {
  query: string;
  collection?: string;
  top_k?: number;
  include_sources?: boolean;
}

export interface SourceDocument {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface QueryResponse {
  answer: string;
  sources: SourceDocument[];
  query: string;
  collection_used: string;
  total_chunks_searched: number;
  generation_time_ms: number;
}

export interface CollectionInfo {
  name: string;
  vectors_count?: number;
  points_count?: number;
}

export interface UploadedDocument {
  id: string;
  filename: string;
  status: string;
  chunks_count: number;
}

export interface DocumentPage {
  documents: unknown[];
  next_page_token?: string;
}

export type SyncTarget = 'posts' | 'comments' | 'resources';

export interface ExportedPoint {
  id: string;
  vector: number[];
  text: string;
  metadata: Record<string, unknown>;
}

export interface ExportedVectors {
  dimension: number;
  points: ExportedPoint[];
}

@Service()
export class RagService {
  private readonly http = inject(HttpClient);

  query(request: QueryRequest): Promise<QueryResponse> {
    return firstValueFrom(
      this.http.post<QueryResponse>(mlUrl('/api/v1/documents:query'), {
        include_sources: true,
        ...request,
      }),
    );
  }

  /** Streams answer tokens over SSE; `fetch` exposes the body as it arrives. */
  async streamQuery(
    request: QueryRequest,
    onToken: (token: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(mlUrl('/api/v1/documents:streamQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    await readSse(response.body, onToken);
  }

  listCollections(): Promise<CollectionInfo[]> {
    return firstValueFrom(
      this.http
        .get<{ collections?: CollectionInfo[] }>(mlUrl('/api/v1/collections'))
        .pipe(map((response) => response.collections ?? [])),
    );
  }

  uploadDocument(file: File): Promise<UploadedDocument> {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(this.http.post<UploadedDocument>(mlUrl('/api/v1/documents'), formData));
  }

  listDocuments(pageSize = 20, pageToken = ''): Promise<DocumentPage> {
    let params = new HttpParams().set('page_size', pageSize);
    if (pageToken) params = params.set('page_token', pageToken);
    return firstValueFrom(this.http.get<DocumentPage>(mlUrl('/api/v1/documents'), { params }));
  }

  getDocument(documentId: string): Promise<unknown> {
    return firstValueFrom(this.http.get<unknown>(this.documentUrl(documentId)));
  }

  /** Resolves to the HTTP status because a successful delete has an empty 204 body. */
  deleteDocument(documentId: string): Promise<{ status: number }> {
    return firstValueFrom(
      this.http
        .delete(this.documentUrl(documentId), { observe: 'response' })
        .pipe(map((response) => ({ status: response.status }))),
    );
  }

  scrapeWebpage(url: string): Promise<unknown> {
    return firstValueFrom(this.http.post<unknown>(mlUrl('/api/v1/webpages:scrape'), { url }));
  }

  crawlWebpages(urls: string[], maxDepth = 1): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(mlUrl('/api/v1/webpages:crawl'), {
        urls,
        max_depth: maxDepth,
      }),
    );
  }

  sync(target: SyncTarget, limit = 1000): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(
        mlUrl(`/api/v1/${target}:sync`),
        target === 'resources' ? {} : { limit },
      ),
    );
  }

  exportVectors(collection: string, limit: number): Promise<ExportedVectors> {
    return firstValueFrom(
      this.http.post<ExportedVectors>(mlUrl('/api/v1/documents:exportVectors'), {
        collection: collection || undefined,
        limit,
      }),
    );
  }

  private documentUrl(documentId: string): string {
    return mlUrl(`/api/v1/documents/${encodeURIComponent(documentId)}`);
  }
}

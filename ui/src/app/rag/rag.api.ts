import { HttpError, deleteJson, getJson, postForm, postJson } from '../shared/http';
import { svcUrl } from '../shared/services';
import { readSse } from '../shared/sse';
import type {
  CollectionInfo,
  ExportedPoint,
  QueryRequest,
  QueryResponse,
  SyncTarget,
} from './rag.model';

export function ragQuery(body: QueryRequest) {
  return postJson<QueryResponse>(svcUrl('rag', '/api/v1/documents:query'), {
    include_sources: true,
    ...body,
  });
}

export async function ragStreamQuery(
  body: QueryRequest,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(svcUrl('rag', '/api/v1/documents:streamQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) throw new HttpError(res.status, `${res.status} ${res.statusText}`);
  await readSse(res.body, onToken);
}

export async function ragCollections(): Promise<CollectionInfo[]> {
  const body = await getJson<{ collections?: CollectionInfo[] }>(
    svcUrl('rag', '/api/v1/collections'),
  );
  return body.collections ?? [];
}

export function ragUpload(file: File) {
  const form = new FormData();
  form.append('file', file);
  return postForm<{ id: string; filename: string; status: string; chunks_count: number }>(
    svcUrl('rag', '/api/v1/documents'),
    form,
  );
}

export function ragListDocuments(pageSize = 20, pageToken = '') {
  const params = new URLSearchParams({ page_size: String(pageSize) });
  if (pageToken) params.set('page_token', pageToken);
  return getJson<{ documents: unknown[]; next_page_token?: string }>(
    svcUrl('rag', `/api/v1/documents?${params}`),
  );
}

export function ragGetDocument(id: string) {
  return getJson<unknown>(svcUrl('rag', `/api/v1/documents/${encodeURIComponent(id)}`));
}

export function ragDeleteDocument(id: string) {
  return deleteJson<unknown>(svcUrl('rag', `/api/v1/documents/${encodeURIComponent(id)}`));
}

export function ragScrape(url: string) {
  return postJson<unknown>(svcUrl('rag', '/api/v1/webpages:scrape'), { url });
}

export function ragCrawl(urls: string[], max_depth = 1) {
  return postJson<unknown>(svcUrl('rag', '/api/v1/webpages:crawl'), { urls, max_depth });
}

export function ragSync(target: SyncTarget, limit = 1000) {
  return postJson<unknown>(
    svcUrl('rag', `/api/v1/${target}:sync`),
    target === 'resources' ? {} : { limit },
  );
}

export function ragExportVectors(collection: string, limit: number) {
  return postJson<{ dimension: number; points: ExportedPoint[] }>(
    svcUrl('rag', '/api/v1/documents:exportVectors'),
    { collection: collection || undefined, limit },
  );
}

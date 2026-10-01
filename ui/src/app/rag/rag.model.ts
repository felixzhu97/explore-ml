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

export type SyncTarget = 'posts' | 'comments' | 'resources';

export interface ExportedPoint {
  id: string;
  vector: number[];
  text: string;
  metadata: Record<string, unknown>;
}

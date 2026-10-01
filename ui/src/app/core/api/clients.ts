import { HttpError, getJson, postForm, postJson } from '../http';
import { svcUrl, toProxyUrl } from '../services';
import { pollJob, type JobStatus, type PollOptions } from './poll';
import { readSse } from './sse';

// recommendation
export type RankSurface = 'feeds' | 'explores' | 'reels';

export interface RankRequest {
  user_id: string;
  candidate_ids: string[];
  limit?: number;
  region?: string;
  language?: string;
  experiment_id?: string;
  variant_id?: string;
}

export interface RankedItem {
  id: string;
  score: number;
}

export function rank(surface: RankSurface, body: RankRequest) {
  return postJson<{ items: RankedItem[] }>(svcUrl('rec', `/api/v1/${surface}:rank`), body);
}

export function recall(user_id: string, limit = 20) {
  return postJson<{ items: RankedItem[] }>(svcUrl('rec', '/api/v1/feeds:recall'), {
    user_id,
    limit,
  });
}

// vision
export type VisionInput = { file: File } | { url: string };

function visionPost<T>(path: string, input: VisionInput, urlKey = 'image_url'): Promise<T> {
  if ('file' in input) {
    const form = new FormData();
    form.append('file', input.file);
    return postForm<T>(svcUrl('vision', path), form);
  }
  return postJson<T>(svcUrl('vision', path), { [urlKey]: input.url });
}

export function predictImage(input: VisionInput) {
  return visionPost<{ labels: string[] }>('/api/v1/images:predict', input);
}

export interface ModerationResult {
  safe: boolean;
  categories: { label: string; score: number }[];
}

export function moderateImage(input: VisionInput) {
  return visionPost<ModerationResult>('/api/v1/images:moderate', input);
}

export function moderateVideo(input: VisionInput) {
  return visionPost<ModerationResult>('/api/v1/videos:moderate', input, 'video_url');
}

// rag
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

export interface CollectionInfo {
  name: string;
  vectors_count?: number;
  points_count?: number;
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

// image / video jobs
interface MediaJob extends JobStatus {
  image_url?: string;
  video_url?: string;
}

export async function generateImage(prompt: string, negative_prompt: string, opts?: PollOptions) {
  const { job_id } = await postJson<{ job_id: string }>(
    svcUrl('image', '/api/v1/images:generate'),
    {
      prompt,
      negative_prompt: negative_prompt || undefined,
    },
  );
  const job = await pollJob(
    () => getJson<MediaJob>(svcUrl('image', `/api/v1/imageJobs/${job_id}`)),
    opts,
  );
  return {
    jobId: job_id,
    url: toProxyUrl('image', job.image_url ?? `/output/image/${job_id}.png`),
  };
}

export async function generateVideo(prompt: string, opts?: PollOptions) {
  const { job_id } = await postJson<{ job_id: string }>(
    svcUrl('video', '/api/v1/videos:generate'),
    { prompt },
  );
  const job = await pollJob(
    () => getJson<MediaJob>(svcUrl('video', `/api/v1/videoJobs/${job_id}`)),
    opts,
  );
  return {
    jobId: job_id,
    url: toProxyUrl('video', job.video_url ?? `/output/video/${job_id}.mp4`),
  };
}

// speech
export async function synthesize(text: string, voice?: string) {
  const { audio_url } = await postJson<{ audio_url: string }>(
    svcUrl('speech', '/api/v1/voices:synthesize'),
    {
      text,
      voice: voice || undefined,
    },
  );
  return toProxyUrl('speech', audio_url);
}

export function transcribe(file: Blob, filename: string, language?: string) {
  const form = new FormData();
  form.append('file', file, filename);
  if (language) form.append('language', language);
  return postForm<{ text: string; language?: string }>(
    svcUrl('speech', '/api/v1/audios:transcribe'),
    form,
  );
}

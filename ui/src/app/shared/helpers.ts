export type HelperId = 'recommendation' | 'vision' | 'rag' | 'image' | 'speech' | 'video';

/** One Python helper under `python_ml/`, reached through the dev-server proxy. */
export interface Helper {
  id: HelperId;
  name: string;
  directory: string;
  port: number;
  urlEnvironmentVariable: string;
  healthPath: string;
}

export const HELPERS: readonly Helper[] = [
  {
    id: 'recommendation',
    name: '推荐',
    directory: 'recommendation',
    port: 8000,
    urlEnvironmentVariable: 'RECOMMENDATION_URL',
    healthPath: '/health',
  },
  {
    id: 'vision',
    name: '视觉',
    directory: 'vision',
    port: 8001,
    urlEnvironmentVariable: 'VISION_URL',
    healthPath: '/health',
  },
  {
    id: 'rag',
    name: 'RAG',
    directory: 'rag',
    port: 8002,
    urlEnvironmentVariable: 'RAG_URL',
    healthPath: '/health/ready',
  },
  {
    id: 'image',
    name: '图像生成',
    directory: 'image-playground',
    port: 8003,
    urlEnvironmentVariable: 'IMAGE_URL',
    healthPath: '/openapi.json',
  },
  {
    id: 'speech',
    name: '语音',
    directory: 'speech',
    port: 8004,
    urlEnvironmentVariable: 'SPEECH_URL',
    healthPath: '/openapi.json',
  },
  {
    id: 'video',
    name: '视频生成',
    directory: 'video',
    port: 8005,
    urlEnvironmentVariable: 'VIDEO_URL',
    healthPath: '/openapi.json',
  },
];

export function findHelper(id: string): Helper | undefined {
  return HELPERS.find((helper) => helper.id === id);
}

export function helperBasePath(id: HelperId): string {
  return `/svc/${id}`;
}

export function helperUrl(id: HelperId, path: string): string {
  return `${helperBasePath(id)}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Rewrites an absolute helper URL (e.g. `http://localhost:8003/output/x.png`) onto the proxy. */
export function toProxyUrl(id: HelperId, url: string): string {
  if (url.startsWith(helperBasePath(id))) return url;
  try {
    const parsedUrl = new URL(url, 'http://placeholder');
    return helperUrl(id, `${parsedUrl.pathname}${parsedUrl.search}`);
  } catch {
    return url;
  }
}

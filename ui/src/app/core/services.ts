export type ServiceId = 'rec' | 'vision' | 'rag' | 'image' | 'speech' | 'video';

export interface Service {
  id: ServiceId;
  name: string;
  dir: string;
  port: number;
  envVar: string;
  healthPath: string;
}

export const SERVICES: readonly Service[] = [
  {
    id: 'rec',
    name: '推荐',
    dir: 'recommendation',
    port: 8000,
    envVar: 'REC_URL',
    healthPath: '/health',
  },
  {
    id: 'vision',
    name: '视觉',
    dir: 'vision',
    port: 8001,
    envVar: 'VISION_URL',
    healthPath: '/health',
  },
  {
    id: 'rag',
    name: 'RAG',
    dir: 'rag',
    port: 8002,
    envVar: 'RAG_URL',
    healthPath: '/health/ready',
  },
  {
    id: 'image',
    name: '图像生成',
    dir: 'image-playground',
    port: 8003,
    envVar: 'IMAGE_URL',
    healthPath: '/health',
  },
  {
    id: 'speech',
    name: '语音',
    dir: 'speech',
    port: 8004,
    envVar: 'SPEECH_URL',
    healthPath: '/health',
  },
  {
    id: 'video',
    name: '视频生成',
    dir: 'video',
    port: 8005,
    envVar: 'VIDEO_URL',
    healthPath: '/health',
  },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function svcBase(id: ServiceId): string {
  return `/svc/${id}`;
}

export function svcUrl(id: ServiceId, path: string): string {
  return `${svcBase(id)}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Rewrites an absolute helper URL (e.g. `http://localhost:8003/output/x.png`) onto the proxy. */
export function toProxyUrl(id: ServiceId, url: string): string {
  if (url.startsWith(svcBase(id))) return url;
  try {
    const parsed = new URL(url, 'http://placeholder');
    return svcUrl(id, `${parsed.pathname}${parsed.search}`);
  } catch {
    return url;
  }
}

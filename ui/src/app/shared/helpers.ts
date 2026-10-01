export type HelperId = 'recommendation' | 'vision' | 'rag' | 'image' | 'speech' | 'video';

/** One module of the `python_ml` app, keyed in `/health` by its package name. */
export interface Helper {
  id: HelperId;
  name: string;
  module: string;
}

export const HELPERS: readonly Helper[] = [
  { id: 'recommendation', name: '推荐', module: 'recommendation' },
  { id: 'vision', name: '视觉', module: 'vision' },
  { id: 'rag', name: 'RAG', module: 'rag' },
  { id: 'image', name: '图像生成', module: 'image_playground' },
  { id: 'speech', name: '语音', module: 'speech' },
  { id: 'video', name: '视频生成', module: 'video' },
];

export function findHelper(id: string): Helper | undefined {
  return HELPERS.find((helper) => helper.id === id);
}

export function mlUrl(path: string): string {
  return `/ml${path}`;
}

/** Rewrites an absolute backend URL (e.g. `http://localhost:8000/output/x.png`) onto the proxy. */
export function toProxyUrl(url: string): string {
  return mlUrl(new URL(url).pathname);
}

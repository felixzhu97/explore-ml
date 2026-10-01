import type { Helper } from './helpers';

export interface ProxyRule {
  target: string;
  changeOrigin: boolean;
  ws: boolean;
  secure: boolean;
  pathRewrite: Record<string, string>;
}

export function proxyTarget(port: number, overrideUrl?: string): string {
  const trimmedUrl = overrideUrl?.trim();
  return trimmedUrl ? trimmedUrl.replace(/\/+$/, '') : `http://127.0.0.1:${port}`;
}

/** Dev-server proxy: `/svc/<id>/*` → helper root, overridable via `<NAME>_URL`. */
export function buildProxy(
  helpers: readonly Helper[],
  environment: Record<string, string | undefined>,
): Record<string, ProxyRule> {
  const rules: Record<string, ProxyRule> = {};
  for (const helper of helpers) {
    const prefix = `/svc/${helper.id}`;
    rules[prefix] = {
      target: proxyTarget(helper.port, environment[helper.urlEnvironmentVariable]),
      changeOrigin: true,
      ws: true,
      secure: false,
      pathRewrite: { [`^${prefix}`]: '' },
    };
  }
  return rules;
}

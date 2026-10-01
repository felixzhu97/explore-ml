import type { Service } from './services';

export interface ProxyRule {
  target: string;
  changeOrigin: boolean;
  ws: boolean;
  secure: boolean;
  pathRewrite: Record<string, string>;
}

export function serviceTarget(port: number, override?: string): string {
  const value = override?.trim();
  return value ? value.replace(/\/+$/, '') : `http://127.0.0.1:${port}`;
}

/** Dev-server proxy: `/svc/<id>/*` → helper root, overridable via `<NAME>_URL`. */
export function buildProxy(
  services: readonly Service[],
  env: Record<string, string | undefined>,
): Record<string, ProxyRule> {
  const rules: Record<string, ProxyRule> = {};
  for (const s of services) {
    const prefix = `/svc/${s.id}`;
    rules[prefix] = {
      target: serviceTarget(s.port, env[s.envVar]),
      changeOrigin: true,
      ws: true,
      secure: false,
      pathRewrite: { [`^${prefix}`]: '' },
    };
  }
  return rules;
}

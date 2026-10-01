// Imported by proxy.conf.mjs under Node, so this file must not import other modules.
export const ML_BASE_PATH = '/ml';
export const ML_PORT = 8000;
export const ML_URL_ENVIRONMENT_VARIABLE = 'EXPLORE_ML_URL';
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

/** Dev-server proxy: `/ml/*` → the python_ml app root, overridable via `EXPLORE_ML_URL`. */
export function buildProxy(
  environment: Record<string, string | undefined>,
): Record<string, ProxyRule> {
  return {
    [ML_BASE_PATH]: {
      target: proxyTarget(ML_PORT, environment[ML_URL_ENVIRONMENT_VARIABLE]),
      changeOrigin: true,
      ws: true,
      secure: false,
      pathRewrite: { [`^${ML_BASE_PATH}`]: '' },
    },
  };
}

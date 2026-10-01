import { HELPERS, findHelper, mlUrl, toProxyUrl } from './helpers';
import { buildProxy, proxyTarget } from './proxy';

describe('helper registry', () => {
  it('should key every helper by its python_ml package name', () => {
    expect(HELPERS.map((helper) => helper.module)).toEqual([
      'recommendation',
      'vision',
      'rag',
      'image_playground',
      'speech',
      'video',
    ]);
  });

  it('should build proxied urls under /ml', () => {
    expect(mlUrl('/api/v1/documents:query')).toBe('/ml/api/v1/documents:query');
    expect(mlUrl('health')).toBe('/ml/health');
  });

  it('should rewrite absolute backend urls onto the proxy', () => {
    expect(toProxyUrl('http://localhost:8000/output/image/job-1.png')).toBe(
      '/ml/output/image/job-1.png',
    );
    expect(toProxyUrl('/ml/output/a.png')).toBe('/ml/output/a.png');
    expect(toProxyUrl('/output/voice/a.mp3')).toBe('/ml/output/voice/a.mp3');
  });

  it('should return undefined for unknown helper ids', () => {
    expect(findHelper('nope')).toBeUndefined();
    expect(findHelper('image')?.module).toBe('image_playground');
  });
});

describe('buildProxy', () => {
  it('should send /ml to the single app on loopback port 8000 by default', () => {
    const rules = buildProxy({});
    expect(Object.keys(rules)).toEqual(['/ml']);
    expect(rules['/ml'].target).toBe('http://127.0.0.1:8000');
    expect(rules['/ml'].ws).toBe(true);
  });

  it('should honour EXPLORE_ML_URL and strip trailing slashes', () => {
    expect(buildProxy({ EXPLORE_ML_URL: 'http://gpu-box:9000/' })['/ml'].target).toBe(
      'http://gpu-box:9000',
    );
    expect(proxyTarget(8000, '  ')).toBe('http://127.0.0.1:8000');
  });

  it('should strip the /ml prefix when rewriting', () => {
    const { pathRewrite } = buildProxy({})['/ml'];
    const [pattern, replacement] = Object.entries(pathRewrite)[0];
    expect('/ml/api/v1/voices:synthesize'.replace(new RegExp(pattern), replacement)).toBe(
      '/api/v1/voices:synthesize',
    );
  });
});

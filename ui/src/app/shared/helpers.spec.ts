import { HELPERS, findHelper, helperUrl, toProxyUrl } from './helpers';
import { buildProxy, proxyTarget } from './proxy';

describe('helper registry', () => {
  it('should map six helpers to contiguous ports 8000-8005', () => {
    expect(HELPERS.map((helper) => helper.port)).toEqual([8000, 8001, 8002, 8003, 8004, 8005]);
  });

  it('should build proxied urls under /svc/<id>', () => {
    expect(helperUrl('rag', '/api/v1/documents:query')).toBe('/svc/rag/api/v1/documents:query');
    expect(helperUrl('recommendation', 'health')).toBe('/svc/recommendation/health');
  });

  it('should rewrite absolute helper urls onto the proxy', () => {
    expect(toProxyUrl('image', 'http://localhost:8003/output/image/job-1.png')).toBe(
      '/svc/image/output/image/job-1.png',
    );
    expect(toProxyUrl('image', '/svc/image/output/a.png')).toBe('/svc/image/output/a.png');
    expect(toProxyUrl('speech', '/output/voice/a.mp3')).toBe('/svc/speech/output/voice/a.mp3');
  });

  it('should return undefined for unknown helper ids', () => {
    expect(findHelper('nope')).toBeUndefined();
    expect(findHelper('vision')?.port).toBe(8001);
  });
});

describe('buildProxy', () => {
  it('should default every target to loopback with the helper port', () => {
    const rules = buildProxy(HELPERS, {});
    expect(Object.keys(rules)).toHaveLength(6);
    expect(rules['/svc/recommendation'].target).toBe('http://127.0.0.1:8000');
    expect(rules['/svc/video'].target).toBe('http://127.0.0.1:8005');
  });

  it('should honour <NAME>_URL overrides and strip trailing slashes', () => {
    const rules = buildProxy(HELPERS, { RAG_URL: 'http://gpu-box:9002/' });
    expect(rules['/svc/rag'].target).toBe('http://gpu-box:9002');
    expect(proxyTarget(8000, '  ')).toBe('http://127.0.0.1:8000');
  });

  it('should strip the /svc/<id> prefix when rewriting', () => {
    const { pathRewrite } = buildProxy(HELPERS, {})['/svc/speech'];
    const [pattern, replacement] = Object.entries(pathRewrite)[0];
    expect('/svc/speech/api/v1/voices:synthesize'.replace(new RegExp(pattern), replacement)).toBe(
      '/api/v1/voices:synthesize',
    );
  });
});

import { HELPERS, findHelper, mlUrl, toProxyUrl } from './helpers';

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
  });

  it('should rewrite absolute backend urls onto the proxy', () => {
    expect(toProxyUrl('http://localhost:8000/output/image/job-1.png')).toBe(
      '/ml/output/image/job-1.png',
    );
  });

  it('should return undefined for unknown helper ids', () => {
    expect(findHelper('nope')).toBeUndefined();
    expect(findHelper('image')?.module).toBe('image_playground');
  });
});

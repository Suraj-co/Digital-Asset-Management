import { requestPath } from './request-context.middleware.js';

describe('requestPath', () => {
  it('keeps the full path and drops the query string', () => {
    expect(
      requestPath({
        originalUrl: '/api/v1/health?token=secret',
        url: '/api/v1/health?token=secret',
        path: '/health',
      }),
    ).toBe('/api/v1/health');
  });

  it('prefers the original URL when the router has rewritten the path', () => {
    expect(
      requestPath({
        originalUrl: '/api/v1/missing',
        url: '/missing',
        path: '/missing',
      }),
    ).toBe('/api/v1/missing');
  });
});
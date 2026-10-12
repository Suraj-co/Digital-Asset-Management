import { resolveCorrelationId } from './request-context.js';

describe('resolveCorrelationId', () => {
  it('keeps a safe caller-supplied id', () => {
    expect(resolveCorrelationId('trace-42')).toBe('trace-42');
  });

  it('replaces a missing id', () => {
    expect(resolveCorrelationId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('replaces an id that could break logs or headers', () => {
    const resolved = resolveCorrelationId('bad id\ninjected');
    expect(resolved).not.toContain('bad id');
    expect(resolved).not.toContain('\n');
  });
});

import { hashSessionToken, readCookie } from './session-token.js';

describe('session token', () => {
  it('hashes a token without keeping the raw value', () => {
    const hash = hashSessionToken('raw-token');
    expect(hash).not.toContain('raw-token');
    expect(hashSessionToken('raw-token')).toBe(hash);
  });

  it('reads one named cookie', () => {
    expect(readCookie('dam_session=abc%2F123; other=no', 'dam_session')).toBe(
      'abc/123',
    );
    expect(readCookie(undefined, 'dam_session')).toBeNull();
    expect(readCookie('other=no', 'dam_session')).toBeNull();
  });
});

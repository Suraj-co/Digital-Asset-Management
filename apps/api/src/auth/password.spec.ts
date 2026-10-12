import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('accepts the password that was hashed and rejects a different one', async () => {
    const stored = await hashPassword('correct-horse-battery');
    expect(stored).not.toContain('correct-horse-battery');
    expect(await verifyPassword('correct-horse-battery', stored)).toBe(true);
    expect(await verifyPassword('wrong-horse-battery', stored)).toBe(false);
  });

  it('rejects a stored value that is not a scrypt hash', async () => {
    expect(await verifyPassword('anything', 'plaintext')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$1$1$1$aa$bb')).toBe(false);
  });
});

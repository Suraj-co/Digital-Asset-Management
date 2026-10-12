import { readSmtp, redisConfigError, smtpConfigError } from './mail-settings.js';

describe('mail settings', () => {
  it('allows every mail setting to stay blank', () => {
    expect(smtpConfigError({})).toBeNull();
    expect(readSmtp({})).toBeNull();
    expect(redisConfigError({})).toBeNull();
  });

  it('names the missing SMTP setting and does not repeat the password', () => {
    const error = smtpConfigError({ SMTP_HOST: 'smtp.example.com', SMTP_PASSWORD: 'secret-mail' });
    expect(error).toContain('SMTP_PORT');
    expect(error).toContain('SMTP_FROM');
    expect(error).not.toContain('secret-mail');
  });

  it('reads a complete SMTP configuration', () => {
    const smtp = readSmtp({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_FROM: 'dam@example.com',
      SMTP_USER: 'dam@example.com',
      SMTP_PASSWORD: 'secret-mail',
    });
    expect(smtp?.host).toBe('smtp.example.com');
    expect(smtp?.port).toBe(587);
  });

  it('rejects a Redis URL that is not redis', () => {
    expect(redisConfigError({ REDIS_URL: 'http://127.0.0.1:6379' })).toContain('redis://');
  });
});

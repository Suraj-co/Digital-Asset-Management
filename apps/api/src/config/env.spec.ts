import { loadEnv } from './env.js';

const valid = {
  NODE_ENV: 'test',
  PORT: '43124',
  WEB_ORIGIN: 'http://127.0.0.1:43123',
  DATABASE_URL: 'postgresql://dam:secret@127.0.0.1:5432/dam_test',
  LOG_LEVEL: 'error',
};

describe('loadEnv', () => {
  it('accepts a complete local configuration', () => {
    expect(loadEnv(valid)).toEqual({
      nodeEnv: 'test',
      port: 43124,
      webOrigin: 'http://127.0.0.1:43123',
      databaseUrl: valid.DATABASE_URL,
      logLevel: 'error',
      rateLimitMax: 240,
      rateLimitWindowMs: 60_000,
    });
  });

  it('rejects a missing database URL', () => {
    const source = { ...valid, DATABASE_URL: undefined };
    expect(() => loadEnv(source)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      loadEnv({ ...valid, DATABASE_URL: 'mysql://localhost/dam' }),
    ).toThrow(/PostgreSQL/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...valid, PORT: '0' })).toThrow(/PORT/);
  });

  it('rejects a rate limit of zero', () => {
    expect(() => loadEnv({ ...valid, RATE_LIMIT_MAX: '0' })).toThrow(/RATE_LIMIT_MAX/);
  });

  it('refuses the workstation database password in production', () => {
    expect(() =>
      loadEnv({
        ...valid,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam',
      }),
    ).toThrow(/workstation password/);
    try {
      loadEnv({
        ...valid,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain('dam_local_dev_only');
    }
  });

  it('allows the workstation database password outside production', () => {
    const loaded = loadEnv({
      ...valid,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam',
    });
    expect(loaded.nodeEnv).toBe('development');
  });

  it('allows a different database password in production', () => {
    const loaded = loadEnv({
      ...valid,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://app:a-different-secret@db.internal:5432/dam',
    });
    expect(loaded.nodeEnv).toBe('production');
    expect(loaded.databaseUrl).not.toContain('dam_local_dev_only');
  });

  it('rejects a partial Google Drive configuration', () => {
    expect(() =>
      loadEnv({ ...valid, GOOGLE_CLIENT_ID: 'client-id' }),
    ).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it('accepts a client id and secret without a shared drive id', () => {
    const loaded = loadEnv({
      ...valid,
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'super-secret-value',
    });
    expect(JSON.stringify(loaded)).not.toContain('super-secret-value');
    expect(JSON.stringify(loaded)).not.toContain('client-id');
  });

  it('rejects a partial SMTP configuration without repeating the password', () => {
    expect(() =>
      loadEnv({ ...valid, SMTP_HOST: 'smtp.example.com', SMTP_PASSWORD: 'secret-mail' }),
    ).toThrow(/SMTP_PORT/);
    try {
      loadEnv({ ...valid, SMTP_PASSWORD: 'secret-mail' });
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-mail');
    }
  });

  it('rejects a Redis URL that is not a redis URL', () => {
    expect(() => loadEnv({ ...valid, REDIS_URL: 'http://127.0.0.1:6379' })).toThrow(/redis:\/\//);
  });

  it('accepts a complete Drive configuration without keeping the secret', () => {
    const loaded = loadEnv({
      ...valid,
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'super-secret-value',
      GOOGLE_REDIRECT_URI: 'http://127.0.0.1:43124/api/v1/storage/oauth/callback',
      GOOGLE_DRIVE_ID: 'shared-drive-id',
    });
    expect(loaded.databaseUrl).toBe(valid.DATABASE_URL);
    expect(JSON.stringify(loaded)).not.toContain('super-secret-value');
  });
});

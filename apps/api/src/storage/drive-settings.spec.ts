import { readDriveConfiguration } from './drive-settings.js';

const complete = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'super-secret-value',
  GOOGLE_REDIRECT_URI: 'http://127.0.0.1:43124/api/v1/storage/oauth/callback',
  GOOGLE_DRIVE_ID: 'shared-drive-id',
};

describe('readDriveConfiguration', () => {
  it('reports the client pair missing when none are set', () => {
    expect(readDriveConfiguration({})).toEqual({
      status: 'not_configured',
      missing: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    });
  });

  it('treats blank values as unset', () => {
    expect(
      readDriveConfiguration({
        GOOGLE_CLIENT_ID: '  ',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_REDIRECT_URI: '',
        GOOGLE_DRIVE_ID: '',
      }),
    ).toMatchObject({ status: 'not_configured' });
  });

  it('accepts the client pair without a shared drive id and does not echo the secret', () => {
    const configuration = readDriveConfiguration({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'super-secret-value',
    });
    expect(configuration).toEqual({
      status: 'configured',
      missing: ['GOOGLE_DRIVE_ID'],
    });
    expect(JSON.stringify(configuration)).not.toContain('super-secret-value');
    expect(JSON.stringify(configuration)).not.toContain('client-id');
  });

  it('refuses a secret without a client id and does not echo the secret', () => {
    try {
      readDriveConfiguration({
        GOOGLE_CLIENT_SECRET: 'super-secret-value',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('GOOGLE_CLIENT_ID');
      expect((error as Error).message).not.toContain('super-secret-value');
    }
  });

  it('rejects a redirect URI that is not a URL', () => {
    expect(() =>
      readDriveConfiguration({
        ...complete,
        GOOGLE_REDIRECT_URI: 'not-a-url',
      }),
    ).toThrow(/GOOGLE_REDIRECT_URI/);
  });

  it('accepts a complete configuration without returning secret values', () => {
    const configuration = readDriveConfiguration(complete);
    expect(configuration).toEqual({ status: 'configured', missing: [] });
    expect(JSON.stringify(configuration)).not.toContain('super-secret-value');
    expect(JSON.stringify(configuration)).not.toContain('client-id');
    expect(JSON.stringify(configuration)).not.toContain('shared-drive-id');
  });
});

import { StorageConnectionService } from './storage-connection.service.js';

describe('StorageConnectionService', () => {
  const service = new StorageConnectionService();

  it('names the missing settings and does not claim a live check', () => {
    const report = service.report('trace-storage', {});
    expect(report).toMatchObject({
      status: 'not_configured',
      provider: 'google_drive',
      liveCheck: 'not_run',
      correlationId: 'trace-storage',
      missing: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    });
    expect(report.detail).toContain('did not call Google');
  });

  it('reports configured credentials without returning them', () => {
    const report = service.report('trace-storage', {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'super-secret-value',
      GOOGLE_REDIRECT_URI: 'http://127.0.0.1:43124/api/v1/storage/oauth/callback',
      GOOGLE_DRIVE_ID: 'shared-drive-id',
    });
    expect(report.status).toBe('configured');
    expect(report.missing).toEqual([]);
    expect(report.liveCheck).toBe('not_run');
    expect(JSON.stringify(report)).not.toContain('super-secret-value');
    expect(JSON.stringify(report)).not.toContain('shared-drive-id');
  });

  it('reports a client pair without opening a shared drive', () => {
    const report = service.report('trace-storage', {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'super-secret-value',
    });
    expect(report.status).toBe('configured');
    expect(report.missing).toEqual(['GOOGLE_DRIVE_ID']);
    expect(report.liveCheck).toBe('not_run');
    expect(report.detail).toContain('did not call Google');
    expect(JSON.stringify(report)).not.toContain('super-secret-value');
    expect(JSON.stringify(report)).not.toContain('client-id');
  });
});

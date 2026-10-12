import { redact } from './redact.js';

describe('redact', () => {
  it('removes credentials embedded in a PostgreSQL URL', () => {
    const message =
      'connect failed for postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam';
    const cleaned = redact(message);
    expect(cleaned).not.toContain('dam_local_dev_only');
    expect(cleaned).toContain('postgresql://***@127.0.0.1:5432/dam');
  });
});

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pgDumpUrl, resolveBackupTarget } from '../../scripts/backup-path.mjs';
import { usesWorkstationDatabasePassword } from '../../scripts/workstation-password.mjs';

const repoRoot = resolve('/work/aaradhya');

describe('usesWorkstationDatabasePassword', () => {
  it('matches the workstation password and ignores the database name', () => {
    expect(
      usesWorkstationDatabasePassword(
        'postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam',
      ),
    ).toBe(true);
    expect(
      usesWorkstationDatabasePassword(
        'postgresql://dam:other-secret@127.0.0.1:5432/dam_local_dev_only',
      ),
    ).toBe(false);
  });
});

describe('resolveBackupTarget', () => {
  it('accepts an absolute path outside the repository', () => {
    expect(resolveBackupTarget(repoRoot, '/tmp/dam.sql')).toBe('/tmp/dam.sql');
  });

  it('rejects a path inside the repository', () => {
    expect(() => resolveBackupTarget(repoRoot, '/work/aaradhya/dam.sql')).toThrow(
      /outside this repository/,
    );
  });

  it('rejects a relative path', () => {
    expect(() => resolveBackupTarget(repoRoot, 'dam.sql')).toThrow(/absolute path/);
  });

  it('rejects a missing path', () => {
    expect(() => resolveBackupTarget(repoRoot, undefined)).toThrow(/Set BACKUP_PATH/);
  });

  it('drops the Prisma schema query before pg_dump', () => {
    const dumped = pgDumpUrl('postgresql://dam:secret@127.0.0.1:5432/dam?schema=public');
    expect(dumped).not.toContain('schema=');
    expect(dumped).toContain('/dam');
  });
});

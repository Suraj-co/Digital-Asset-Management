import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgDumpUrl, resolveBackupTarget } from './backup-path.mjs';
import { usesWorkstationDatabasePassword } from './workstation-password.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Set DATABASE_URL.');
  process.exit(1);
}
if (
  process.env.NODE_ENV === 'production' &&
  usesWorkstationDatabasePassword(databaseUrl)
) {
  console.error(
    'DATABASE_URL uses the workstation password. Set a different password before production.',
  );
  process.exit(1);
}

let target;
try {
  target = resolveBackupTarget(repoRoot, process.env.BACKUP_PATH);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'BACKUP_PATH is not usable.');
  process.exit(1);
}

const dump = spawnSync(
  'pg_dump',
  ['--format=plain', '--no-owner', '--file', target, '--dbname', pgDumpUrl(databaseUrl)],
  { stdio: ['ignore', 'inherit', 'inherit'] },
);
if (dump.error) {
  console.error('pg_dump could not be started.');
  process.exit(1);
}
if (dump.status !== 0) {
  process.exit(dump.status ?? 1);
}

const bytes = statSync(target).size;
console.log(
  JSON.stringify({
    path: target,
    bytes,
    note: 'Local dump only. It is not copied off this machine. Google Drive retention is not configured.',
  }),
);

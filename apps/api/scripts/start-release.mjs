import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usesWorkstationDatabasePassword } from './workstation-password.mjs';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (
  process.env.NODE_ENV === 'production' &&
  usesWorkstationDatabasePassword(process.env.DATABASE_URL ?? '')
) {
  console.error(
    'DATABASE_URL uses the workstation password. Set a different password before production.',
  );
  process.exit(1);
}

const migrate = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  cwd: apiRoot,
  stdio: 'inherit',
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const server = spawnSync(process.execPath, ['dist/main.js'], {
  cwd: apiRoot,
  stdio: 'inherit',
});
process.exit(server.status ?? 1);

import { isAbsolute, relative, resolve, sep } from 'node:path';

export function pgDumpUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  url.searchParams.delete('schema');
  return url.toString();
}

export function resolveBackupTarget(repoRoot, backupPath) {
  if (typeof backupPath !== 'string' || backupPath.trim() === '') {
    throw new Error('Set BACKUP_PATH to an absolute path outside this repository.');
  }
  if (!isAbsolute(backupPath)) {
    throw new Error('BACKUP_PATH must be an absolute path outside this repository.');
  }
  const target = resolve(backupPath);
  const fromRoot = relative(resolve(repoRoot), target);
  const outside = fromRoot === '..' || fromRoot.startsWith(`..${sep}`);
  if (!outside) {
    throw new Error(
      'BACKUP_PATH must be outside this repository. A dump contains password hashes.',
    );
  }
  return target;
}

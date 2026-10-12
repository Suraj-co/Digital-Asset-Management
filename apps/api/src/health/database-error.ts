export const DATABASE_ERROR_CATEGORIES = [
  'connection_refused',
  'timeout',
  'authentication_failed',
  'database_not_found',
  'database_unavailable',
] as const;

export type DatabaseErrorCategory = (typeof DATABASE_ERROR_CATEGORIES)[number];

function errorText(error: unknown): string {
  if (!error || typeof error === 'string') {
    return typeof error === 'string' ? error : '';
  }
  if (error instanceof Error) {
    const code =
      'code' in error && typeof error.code === 'string' ? error.code : '';
    const cause =
      'cause' in error && error.cause ? errorText(error.cause) : '';
    return `${error.name} ${code} ${error.message} ${cause}`;
  }
  return '';
}

export function classifyDatabaseError(error: unknown): DatabaseErrorCategory {
  const text = errorText(error).toLowerCase();
  if (text.includes('econnrefused')) {
    return 'connection_refused';
  }
  if (
    text.includes('etimedout') ||
    text.includes('timeout') ||
    text.includes('connection terminated due to connection timeout')
  ) {
    return 'timeout';
  }
  if (
    text.includes('password authentication failed') ||
    text.includes('28p01')
  ) {
    return 'authentication_failed';
  }
  if (text.includes('3d000') || text.includes('does not exist')) {
    return 'database_not_found';
  }
  return 'database_unavailable';
}

export function isLikelyDatabaseError(error: unknown): boolean {
  const text = errorText(error);
  const lower = text.toLowerCase();
  return (
    text.includes('PrismaClient') ||
    text.includes('ECONNREFUSED') ||
    text.includes('ETIMEDOUT') ||
    text.includes('28P01') ||
    text.includes('3D000') ||
    lower.includes('password authentication failed')
  );
}

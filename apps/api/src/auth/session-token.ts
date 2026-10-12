import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'dam_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function readCookie(
  header: string | undefined,
  name: string,
): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const cookieName = part.slice(0, separator).trim();
    if (cookieName !== name) {
      continue;
    }
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function sessionCookieOptions(secure: boolean): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

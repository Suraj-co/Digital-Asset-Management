import { z } from 'zod';

export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    status: z.enum(['active', 'disabled']),
  }),
  expiresAt: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;

export class SessionRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRequestError';
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The session request failed.';
}

export async function fetchSession(): Promise<Session | null> {
  const response = await fetch('/api/v1/session', { credentials: 'include' });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new SessionRequestError(await readError(response));
  }
  const parsed = sessionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SessionRequestError('The session response did not match the contract.');
  }
  return parsed.data;
}

export async function createSession(
  email: string,
  password: string,
): Promise<Session> {
  const response = await fetch('/api/v1/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new SessionRequestError(await readError(response));
  }
  const parsed = sessionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SessionRequestError('The session response did not match the contract.');
  }
  return parsed.data;
}

export async function deleteSession(): Promise<void> {
  const response = await fetch('/api/v1/session', {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok && response.status !== 204) {
    throw new SessionRequestError(await readError(response));
  }
}

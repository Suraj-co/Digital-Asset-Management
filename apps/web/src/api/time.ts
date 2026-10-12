import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';

export const timeEntrySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyCode: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  taskId: z.string().nullable(),
  taskTitle: z.string().nullable(),
  workDate: z.string(),
  minutes: z.number(),
  note: z.string(),
  status: z.enum(['open', 'submitted', 'accepted', 'returned']),
  reviewReason: z.string().nullable(),
  actions: z.array(z.enum(['submit', 'accept', 'return'])),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const timePageSchema = z.object({
  items: z.array(timeEntrySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type TimeEntry = z.infer<typeof timeEntrySchema>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
    if (Array.isArray(body.message) && body.message.every((item) => typeof item === 'string')) {
      return body.message.join(' ');
    }
  } catch {
    // The body was not JSON.
  }
  return 'The time request failed.';
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    throw new CompanyRequestError(await readError(response));
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new CompanyRequestError('The time response did not match the contract.');
  }
  return parsed.data;
}

export function fetchTimeEntries(companyId: string) {
  const params = new URLSearchParams({ companyId, limit: '100', offset: '0' });
  return fetch(`/api/v1/time-entries?${params}`, { credentials: 'include' }).then((response) =>
    parse(response, timePageSchema),
  );
}

export function createTimeEntry(input: {
  companyId: string;
  workDate: string;
  minutes: number;
  note?: string;
  taskId?: string;
}) {
  return fetch('/api/v1/time-entries', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => parse(response, timeEntrySchema));
}

export function updateTimeEntry(entryId: string, input: { minutes: number }) {
  return fetch(`/api/v1/time-entries/${entryId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => parse(response, timeEntrySchema));
}

export function reviewTimeEntry(
  entryId: string,
  input: { action: 'submit' | 'accept' | 'return'; reason?: string },
) {
  return fetch(`/api/v1/time-entries/${entryId}/review`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => parse(response, timeEntrySchema));
}

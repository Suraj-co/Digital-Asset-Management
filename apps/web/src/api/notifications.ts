import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';

export const notificationSchema = z.object({
  id: z.string(),
  companyCode: z.string(),
  kind: z.enum([
    'task_assigned',
    'task_updated',
    'time_returned',
    'asset_rejected',
    'asset_submitted',
    'asset_approved',
  ]),
  body: z.string(),
  href: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  email: z
    .object({
      status: z.enum(['pending', 'queued', 'held', 'sent', 'failed']),
      detail: z.string(),
      toAddress: z.string(),
    })
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  total: z.number(),
  unread: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type NotificationItem = z.infer<typeof notificationSchema>;
export type NotificationPage = z.infer<typeof notificationPageSchema>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The notification request failed.';
}

export function fetchNotifications(limit = 20) {
  const params = new URLSearchParams({ limit: String(limit), offset: '0' });
  return fetch(`/api/v1/notifications?${params}`, { credentials: 'include' }).then(
    async (response) => {
      if (!response.ok) {
        throw new CompanyRequestError(await readError(response));
      }
      const parsed = notificationPageSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new CompanyRequestError('The notification response did not match the contract.');
      }
      return parsed.data;
    },
  );
}

export function markNotificationRead(notificationId: string) {
  return fetch(`/api/v1/notifications/${notificationId}/read`, {
    method: 'POST',
    credentials: 'include',
  }).then(async (response) => {
    if (!response.ok) {
      throw new CompanyRequestError(await readError(response));
    }
    const parsed = notificationSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new CompanyRequestError('The notification response did not match the contract.');
    }
    return parsed.data;
  });
}

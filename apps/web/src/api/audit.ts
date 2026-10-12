import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';

export const auditEventSchema = z.object({
  id: z.string(),
  companyCode: z.string(),
  actorEmail: z.string(),
  action: z.string(),
  summary: z.string(),
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  createdAt: z.string(),
});

export const auditPageSchema = z.object({
  items: z.array(auditEventSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type AuditPage = z.infer<typeof auditPageSchema>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The audit request failed.';
}

export function fetchAuditEvents(companyId: string) {
  const params = new URLSearchParams({ companyId, limit: '20', offset: '0' });
  return fetch(`/api/v1/audit-events?${params}`, { credentials: 'include' }).then(
    async (response) => {
      if (!response.ok) {
        throw new CompanyRequestError(await readError(response));
      }
      const parsed = auditPageSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new CompanyRequestError('The audit response did not match the contract.');
      }
      return parsed.data;
    },
  );
}

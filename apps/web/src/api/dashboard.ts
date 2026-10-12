import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';

const stageCountsSchema = z.object({
  draft: z.number(),
  scope_analysis: z.number(),
  rm_qc: z.number(),
  rm_approval: z.number(),
  admin_qc: z.number(),
  admin_approval: z.number(),
  changes_requested: z.number(),
});

export const dashboardSchema = z.object({
  companyId: z.string(),
  companyCode: z.string(),
  scope: z.enum(['own', 'review', 'company']),
  assets: z.object({
    total: z.number(),
    uploadFailed: z.number(),
    publicationNotStarted: z.number(),
    publicationNotRun: z.number(),
    publicationReady: z.number(),
    byStage: stageCountsSchema,
  }),
  queues: z.object({
    drafts: z.number(),
    rmReview: z.number(),
    changesRequested: z.number(),
    adminReview: z.number(),
    readyToPublish: z.number(),
  }),
  tasks: z.object({
    open: z.number(),
    done: z.number(),
  }),
  time: z.object({
    open: z.number(),
    submitted: z.number(),
    accepted: z.number(),
    returned: z.number(),
    minutes: z.number(),
  }),
  payroll: z.object({
    acceptedMinutes: z.number(),
    hourlyRateMinor: z.number().nullable(),
    currency: z.enum(['INR', 'USD', 'EUR']),
    amountMinor: z.number().nullable(),
    detail: z.string(),
  }),
});

export type Dashboard = z.infer<typeof dashboardSchema>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The dashboard request failed.';
}

export function fetchDashboard(companyId: string) {
  const params = new URLSearchParams({ companyId });
  return fetch(`/api/v1/dashboard?${params}`, { credentials: 'include' }).then(async (response) => {
    if (!response.ok) {
      throw new CompanyRequestError(await readError(response));
    }
    const parsed = dashboardSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new CompanyRequestError('The dashboard response did not match the contract.');
    }
    return parsed.data;
  });
}

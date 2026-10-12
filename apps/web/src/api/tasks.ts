import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';

export const taskSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyCode: z.string(),
  title: z.string(),
  detail: z.string(),
  status: z.enum(['open', 'done']),
  stage: z
    .enum([
      'draft',
      'assigned',
      'in_progress',
      'submitted_rm_qc',
      'rm_approved',
      'submitted_admin_qc',
      'admin_approved',
      'ready_to_publish',
      'completed',
      'changes_requested',
    ])
    .default('draft'),
  actions: z
    .array(z.enum(['start', 'submit', 'approve', 'reject', 'complete', 'resubmit']))
    .default([]),
  departmentId: z.string().nullable().default(null),
  departmentName: z.string().nullable().default(null),
  deadline: z.string().nullable(),
  priority: z.enum(['low', 'normal', 'high']).nullable(),
  assetId: z.string().nullable(),
  assetCode: z.string().nullable(),
  assigneeId: z.string().nullable(),
  assigneeEmail: z.string().nullable(),
  createdByEmail: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const taskPageSchema = z.object({
  items: z.array(taskSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  stages: z.record(z.string(), z.number()).optional(),
});

const taskDetailSchema = taskSchema.extend({
  comments: z.array(
    z.object({
      id: z.string(),
      authorEmail: z.string(),
      body: z.string(),
      createdAt: z.string(),
    }),
  ),
  files: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      byteSize: z.number(),
      driveFileId: z.string().nullable(),
      detail: z.string(),
      createdByEmail: z.string(),
      createdAt: z.string(),
    }),
  ),
  history: z.array(
    z.object({
      actorEmail: z.string(),
      summary: z.string(),
      createdAt: z.string(),
    }),
  ),
});

export type TaskDetail = z.infer<typeof taskDetailSchema>;

export type Task = z.infer<typeof taskSchema>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The task request failed.';
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    throw new CompanyRequestError(await readError(response));
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new CompanyRequestError('The task response did not match the contract.');
  }
  return parsed.data;
}

export function fetchTasks(companyId: string, departmentId?: string) {
  const params = new URLSearchParams({ companyId, limit: '100', offset: '0' });
  if (departmentId) {
    params.set('departmentId', departmentId);
  }
  return fetch(`/api/v1/tasks?${params}`, { credentials: 'include' }).then((response) =>
    parse(response, taskPageSchema),
  );
}

export function fetchTask(taskId: string) {
  return fetch(`/api/v1/tasks/${taskId}`, { credentials: 'include' }).then((response) =>
    parse(response, taskDetailSchema),
  );
}

export function transitionTask(taskId: string, action: Task['actions'][number], reason?: string) {
  return fetch(`/api/v1/tasks/${taskId}/transitions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(reason ? { action, reason } : { action }),
  }).then((response) => parse(response, taskDetailSchema));
}

export function commentOnTask(taskId: string, body: string) {
  return fetch(`/api/v1/tasks/${taskId}/comments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body }),
  }).then((response) => parse(response, taskDetailSchema));
}

export function createTask(input: {
  companyId: string;
  title: string;
  detail?: string;
  assetId?: string;
  assigneeEmail?: string;
  deadline?: string;
  priority?: 'low' | 'normal' | 'high';
}) {
  return fetch('/api/v1/tasks', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => parse(response, taskSchema));
}

export function updateTask(
  taskId: string,
  input: { status?: 'open' | 'done'; title?: string },
) {
  return fetch(`/api/v1/tasks/${taskId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => parse(response, taskSchema));
}

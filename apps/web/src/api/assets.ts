import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';

export const assetVersionSchema = z.object({
  id: z.string(),
  number: z.number(),
  label: z.string(),
  fileName: z.string(),
  byteSize: z.number(),
  contentType: z.string(),
  state: z.literal('upload_failed'),
  driveFileId: z.string().nullable(),
  failureClass: z.literal('not_configured'),
  detail: z.string(),
  createdAt: z.string(),
});

const workflowStageSchema = z.enum([
  'draft',
  'scope_analysis',
  'rm_qc',
  'rm_approval',
  'admin_qc',
  'admin_approval',
  'changes_requested',
]);

const workflowActionSchema = z.enum(['submit', 'approve', 'reject', 'publish']);

const decisionSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  versionLabel: z.string(),
  action: z.enum(['submit', 'approve', 'reject', 'publish', 'resubmit']),
  fromStage: workflowStageSchema,
  toStage: workflowStageSchema,
  reason: z.string().nullable(),
  detail: z.string(),
  actorEmail: z.string(),
  createdAt: z.string(),
});

export const assetSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyCode: z.string(),
  folderId: z.string(),
  path: z.string(),
  code: z.string(),
  title: z.string(),
  state: z.literal('upload_failed'),
  fileName: z.string(),
  byteSize: z.number(),
  contentType: z.string(),
  driveFileId: z.string().nullable(),
  failureClass: z.literal('not_configured'),
  detail: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  workflowStage: workflowStageSchema,
  publication: z.enum(['not_started', 'not_run', 'ready']),
  actions: z.array(workflowActionSchema),
  decisions: z.array(decisionSchema),
  versions: z.array(assetVersionSchema),
});

const assetPageSchema = z.object({
  items: z.array(assetSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type Asset = z.infer<typeof assetSchema>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The asset request failed.';
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    throw new CompanyRequestError(await readError(response));
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new CompanyRequestError('The asset response did not match the contract.');
  }
  return parsed.data;
}

export function fetchAssets(companyId: string, query = '', folderId?: string) {
  const params = new URLSearchParams({
    companyId,
    limit: '100',
    offset: '0',
  });
  const q = query.trim();
  if (q.length > 0) {
    params.set('q', q);
  }
  if (folderId) {
    params.set('folderId', folderId);
  }
  return fetch(`/api/v1/assets?${params}`, { credentials: 'include' }).then((response) =>
    parse(response, assetPageSchema),
  );
}

export function fetchAsset(assetId: string) {
  return fetch(`/api/v1/assets/${assetId}`, { credentials: 'include' }).then((response) =>
    parse(response, assetSchema),
  );
}

export function updateAssetTitle(assetId: string, title: string) {
  return fetch(`/api/v1/assets/${assetId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  }).then((response) => parse(response, assetSchema));
}

export function createAsset(input: {
  folderId: string;
  title: string;
  file: File;
  idempotencyKey: string;
}) {
  const body = new FormData();
  body.set('folderId', input.folderId);
  body.set('title', input.title);
  body.set('file', input.file);
  return fetch('/api/v1/assets', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body,
  }).then((response) => parse(response, assetSchema));
}

export function createAssetVersion(assetId: string, file: File, idempotencyKey: string) {
  const body = new FormData();
  body.set('file', file);
  return fetch(`/api/v1/assets/${assetId}/versions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Idempotency-Key': idempotencyKey },
    body,
  }).then((response) => parse(response, assetSchema));
}

export function transitionAsset(
  assetId: string,
  input: { action: 'submit' | 'approve' | 'reject' | 'publish'; reason?: string },
) {
  return fetch(`/api/v1/assets/${assetId}/transitions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => parse(response, assetSchema));
}

export function deleteAsset(assetId: string) {
  return fetch(`/api/v1/assets/${assetId}`, {
    method: 'DELETE',
    credentials: 'include',
  }).then(async (response) => {
    if (!response.ok) {
      throw new CompanyRequestError(await readError(response));
    }
  });
}

export async function fetchAssetFile(assetId: string, inline: boolean): Promise<Blob> {
  const disposition = inline ? 'inline' : 'attachment';
  const response = await fetch(
    `/api/v1/assets/${assetId}/file?disposition=${disposition}`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    throw new CompanyRequestError(await readError(response));
  }
  return response.blob();
}

export function retryAsset(assetId: string, file: File) {
  const body = new FormData();
  body.set('file', file);
  return fetch(`/api/v1/assets/${assetId}/content`, {
    method: 'POST',
    credentials: 'include',
    body,
  }).then((response) => parse(response, assetSchema));
}

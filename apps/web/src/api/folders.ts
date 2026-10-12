import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';

const departmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  active: z.boolean(),
});

const departmentPageSchema = z.object({
  items: z.array(departmentSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const folderSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyCode: z.string(),
  departmentId: z.string(),
  departmentName: z.string(),
  year: z.number(),
  campaign: z.string(),
  stage: z.enum(['working', 'approved', 'archive']),
  assetType: z.enum([
    'images',
    'videos',
    'posters',
    'banners',
    'source_files',
    'other',
  ]),
  path: z.string(),
  driveFolderId: z.string().nullable(),
  liveCheck: z.literal('not_run'),
  detail: z.string(),
});

const folderPageSchema = z.object({
  items: z.array(folderSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type Department = z.infer<typeof departmentSchema>;
export type FolderCatalog = z.infer<typeof folderSchema>;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The folder request failed.';
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    throw new CompanyRequestError(await readError(response));
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new CompanyRequestError('The folder response did not match the contract.');
  }
  return parsed.data;
}

export function fetchDepartments(companyId: string) {
  return fetch(`/api/v1/companies/${companyId}/departments?limit=100&offset=0`, {
    credentials: 'include',
  }).then((response) => parse(response, departmentPageSchema));
}

export function createDepartment(companyId: string, name: string) {
  return fetch(`/api/v1/companies/${companyId}/departments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then((response) => parse(response, departmentSchema));
}

export function fetchFolders(companyId: string) {
  return fetch(`/api/v1/storage/folders?companyId=${companyId}&limit=100&offset=0`, {
    credentials: 'include',
  }).then((response) => parse(response, folderPageSchema));
}

export function renameFolder(folderId: string, campaign: string) {
  return fetch(`/api/v1/storage/folders/${folderId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign }),
  }).then((response) => parse(response, folderSchema));
}

export function resolveFolder(input: {
  companyId: string;
  departmentId: string;
  year: number;
  campaign: string;
  stage: FolderCatalog['stage'];
  assetType: FolderCatalog['assetType'];
}) {
  return fetch('/api/v1/storage/folders/resolve', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => parse(response, folderSchema));
}

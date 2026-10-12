import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DEFAULT_GOOGLE_REDIRECT_URI } from './drive-settings.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

export type HistoryRow = {
  actor: string;
  action: string;
  company: string;
  path: string;
  name: string;
  driveId: string;
  detail: string;
};

type WorkspaceEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  driveRootId: string;
  sheetsId: string;
  redirectUri: string;
};

function blank(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function readWorkspaceEnv(source: NodeJS.ProcessEnv = process.env): WorkspaceEnv {
  return {
    clientId: blank(source.GOOGLE_CLIENT_ID),
    clientSecret: blank(source.GOOGLE_CLIENT_SECRET),
    refreshToken: blank(source.GOOGLE_REFRESH_TOKEN),
    driveRootId: blank(source.GOOGLE_DRIVE_ID) || blank(source.GOOGLE_DRIVE_ROOT_ID),
    sheetsId: blank(source.GOOGLE_SHEETS_ID),
    redirectUri: blank(source.GOOGLE_REDIRECT_URI) || DEFAULT_GOOGLE_REDIRECT_URI,
  };
}

export function folderSegments(path: string): string[] {
  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts[0] === 'AARADHYA_DAM') {
    return parts.slice(1);
  }
  return parts;
}

export function setEnvLine(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^#?\\s*${key}=.*$`, 'm');
  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }
  const suffix = text.endsWith('\n') || text.length === 0 ? '' : '\n';
  return `${text}${suffix}${line}\n`;
}

export function workspaceEnvPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../../../.env');
}

export function writeWorkspaceEnv(key: string, value: string, filePath = workspaceEnvPath()): void {
  const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  writeFileSync(filePath, setEnvLine(current, key, value), 'utf8');
}

@Injectable()
export class GoogleWorkspaceService {
  private readonly logger = new Logger(GoogleWorkspaceService.name);
  private accessToken: { value: string; expiresAt: number } | null = null;
  private readonly states = new Map<string, number>();

  driveReady(source: NodeJS.ProcessEnv = process.env): boolean {
    return this.missingDriveSetting(source) === null;
  }

  missingDriveSetting(source: NodeJS.ProcessEnv = process.env): string | null {
    const env = readWorkspaceEnv(source);
    if (!env.clientId || !env.clientSecret) {
      return 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET';
    }
    if (!env.refreshToken) {
      return 'GOOGLE_REFRESH_TOKEN';
    }
    if (!env.driveRootId) {
      return 'GOOGLE_DRIVE_ROOT_ID';
    }
    return null;
  }

  sheetsReady(source: NodeJS.ProcessEnv = process.env): boolean {
    const env = readWorkspaceEnv(source);
    return Boolean(env.clientId && env.clientSecret && env.refreshToken && env.sheetsId);
  }

  clientReady(source: NodeJS.ProcessEnv = process.env): boolean {
    const env = readWorkspaceEnv(source);
    return Boolean(env.clientId && env.clientSecret);
  }

  authorizationUrl(source: NodeJS.ProcessEnv = process.env): string | null {
    const env = readWorkspaceEnv(source);
    if (!env.clientId || !env.clientSecret) {
      return null;
    }
    const state = randomBytes(16).toString('hex');
    this.states.set(state, Date.now() + 10 * 60 * 1000);
    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', env.clientId);
    url.searchParams.set('redirect_uri', env.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async connect(code: string, state: string, source: NodeJS.ProcessEnv = process.env): Promise<void> {
    const expiresAt = this.states.get(state);
    this.states.delete(state);
    if (!expiresAt || expiresAt < Date.now()) {
      throw new Error('The Google sign-in expired. Open the connect page again.');
    }
    const env = readWorkspaceEnv(source);
    if (!env.clientId || !env.clientSecret) {
      throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before connecting Google.');
    }
    const body = new URLSearchParams({
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
      grant_type: 'authorization_code',
    });
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      throw new Error(`Google refused the sign-in (${response.status}).`);
    }
    const payload = (await response.json()) as { refresh_token?: string };
    if (!payload.refresh_token) {
      throw new Error(
        'Google did not return a refresh token. Remove this app from the Google account permissions and connect again.',
      );
    }
    process.env.GOOGLE_REFRESH_TOKEN = payload.refresh_token;
    writeWorkspaceEnv('GOOGLE_REFRESH_TOKEN', payload.refresh_token);
    this.accessToken = null;
  }

  async ensureFolder(path: string): Promise<string | null> {
    if (!this.driveReady()) {
      return null;
    }
    const env = readWorkspaceEnv();
    let parentId = env.driveRootId;
    for (const name of folderSegments(path)) {
      parentId = await this.findOrCreateFolder(parentId, name);
    }
    return parentId;
  }

  async uploadFile(input: {
    parentId: string;
    name: string;
    contentType: string;
    body: Buffer;
  }): Promise<string> {
    const token = await this.token();
    const boundary = `aaradhya${randomBytes(8).toString('hex')}`;
    const metadata = JSON.stringify({ name: input.name, parents: [input.parentId] });
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.contentType}\r\n\r\n`,
      ),
      input.body,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const url = new URL('https://www.googleapis.com/upload/drive/v3/files');
    url.searchParams.set('uploadType', 'multipart');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('fields', 'id');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: payload,
    });
    if (!response.ok) {
      throw new Error(`Google Drive did not store the file (${response.status}).`);
    }
    const created = (await response.json()) as { id?: string };
    if (!created.id) {
      throw new Error('Google Drive did not return a file id.');
    }
    return created.id;
  }

  async downloadFile(fileId: string): Promise<{ bytes: Buffer; contentType: string }> {
    const token = await this.token();
    const url = new URL(`${DRIVE_FILES}/${encodeURIComponent(fileId)}`);
    url.searchParams.set('alt', 'media');
    url.searchParams.set('supportsAllDrives', 'true');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw new Error(`Google Drive did not return the file (${response.status}).`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      bytes,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    };
  }

  async renameFile(fileId: string, name: string): Promise<void> {
    const token = await this.token();
    const url = new URL(`${DRIVE_FILES}/${encodeURIComponent(fileId)}`);
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('fields', 'id');
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Google Drive did not rename the file (${response.status}).`);
    }
  }

  async filePresence(fileId: string): Promise<'active' | 'trashed' | 'missing'> {
    const token = await this.token();
    const url = new URL(`${DRIVE_FILES}/${encodeURIComponent(fileId)}`);
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('fields', 'id,trashed');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404) {
      return 'missing';
    }
    if (!response.ok) {
      throw new Error(`Google Drive did not return the file (${response.status}).`);
    }
    const body = (await response.json()) as { trashed?: boolean };
    return body.trashed ? 'trashed' : 'active';
  }

  async trashFile(fileId: string): Promise<void> {
    const token = await this.token();
    const url = new URL(`${DRIVE_FILES}/${encodeURIComponent(fileId)}`);
    url.searchParams.set('supportsAllDrives', 'true');
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trashed: true }),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Google Drive did not delete the file (${response.status}).`);
    }
  }

  async renameSegment(path: string, index: number, nextName: string): Promise<void> {
    if (!this.driveReady()) {
      return;
    }
    const segments = folderSegments(path);
    if (index < 0 || index >= segments.length) {
      throw new Error('That folder is not in the stored path.');
    }
    let parentId = readWorkspaceEnv().driveRootId;
    for (let i = 0; i < index; i += 1) {
      const found = await this.findFolder(parentId, segments[i] ?? '');
      if (!found) {
        throw new Error('Google Drive does not have that parent folder.');
      }
      parentId = found;
    }
    const current = await this.findFolder(parentId, segments[index] ?? '');
    if (!current) {
      throw new Error('Google Drive does not have that folder.');
    }
    await this.renameFile(current, nextName);
  }

  async appendHistory(row: HistoryRow): Promise<void> {
    if (!this.sheetsReady()) {
      return;
    }
    try {
      const env = readWorkspaceEnv();
      const token = await this.token();
      const url = new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.sheetsId)}/values/A1:append`,
      );
      url.searchParams.set('valueInputOption', 'USER_ENTERED');
      url.searchParams.set('insertDataOption', 'INSERT_ROWS');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[
            new Date().toISOString(),
            row.actor,
            row.action,
            row.company,
            row.path,
            row.name,
            row.driveId,
            row.detail,
          ]],
        }),
      });
      if (!response.ok) {
        this.logger.warn(`History sheet append failed (${response.status}).`);
      }
    } catch {
      this.logger.warn('History sheet append failed.');
    }
  }

  private async findFolder(parentId: string, name: string): Promise<string | null> {
    const token = await this.token();
    const escaped = name.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    const query = [
      `name = '${escaped}'`,
      `'${parentId}' in parents`,
      "mimeType = 'application/vnd.google-apps.folder'",
      'trashed = false',
    ].join(' and ');
    const listUrl = new URL(DRIVE_FILES);
    listUrl.searchParams.set('q', query);
    listUrl.searchParams.set('fields', 'files(id,name)');
    listUrl.searchParams.set('pageSize', '1');
    listUrl.searchParams.set('supportsAllDrives', 'true');
    listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
    const listed = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!listed.ok) {
      throw new Error(`Google Drive did not list folders (${listed.status}).`);
    }
    const found = (await listed.json()) as { files?: Array<{ id?: string }> };
    return found.files?.[0]?.id ?? null;
  }

  private async findOrCreateFolder(parentId: string, name: string): Promise<string> {
    const existing = await this.findFolder(parentId, name);
    if (existing) {
      return existing;
    }
    const token = await this.token();
    const createUrl = new URL(DRIVE_FILES);
    createUrl.searchParams.set('supportsAllDrives', 'true');
    createUrl.searchParams.set('fields', 'id');
    const created = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });
    if (!created.ok) {
      throw new Error(`Google Drive did not create a folder (${created.status}).`);
    }
    const folder = (await created.json()) as { id?: string };
    if (!folder.id) {
      throw new Error('Google Drive did not return a folder id.');
    }
    return folder.id;
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
      return this.accessToken.value;
    }
    const env = readWorkspaceEnv();
    const body = new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: env.refreshToken,
      grant_type: 'refresh_token',
    });
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      throw new Error(`Google authentication failed (${response.status}).`);
    }
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) {
      throw new Error('Google authentication failed.');
    }
    const seconds = payload.expires_in ?? 3600;
    this.accessToken = {
      value: payload.access_token,
      expiresAt: Date.now() + Math.max(60, seconds - 60) * 1000,
    };
    return payload.access_token;
  }
}

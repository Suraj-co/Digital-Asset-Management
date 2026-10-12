export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const UPLOAD_FAILURE_DETAIL =
  'Google Drive was not called. The file was not stored. Send it again after Drive is configured.';

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,119}$/;

export type UploadMeta = {
  fileName: string;
  byteSize: number;
  contentType: string;
  bytes?: Buffer;
};

export function readUploadMeta(file: {
  originalname?: string;
  mimetype?: string;
  size?: number;
} | undefined): UploadMeta | null {
  if (!file || typeof file.size !== 'number' || file.size < 1) {
    return null;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return null;
  }
  const base = file.originalname?.split(/[/\\]/).pop()?.trim() ?? '';
  if (!FILE_NAME.test(base) || base.includes('..')) {
    return null;
  }
  const contentType = (file.mimetype ?? '').trim().slice(0, 120);
  return {
    fileName: base,
    byteSize: file.size,
    contentType: contentType.length > 0 ? contentType : 'application/octet-stream',
  };
}

export function readIdempotencyKey(
  value: string | undefined,
): { ok: true; key: string | null } | { ok: false } {
  if (value === undefined || value.trim() === '') {
    return { ok: true, key: null };
  }
  const key = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(key)) {
    return { ok: false };
  }
  return { ok: true, key };
}

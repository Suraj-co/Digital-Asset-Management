import { describe, expect, it } from 'vitest';
import { readIdempotencyKey, readUploadMeta } from './upload-file.js';

describe('readUploadMeta', () => {
  it('keeps the file name and drops any path', () => {
    expect(
      readUploadMeta({
        originalname: '../secret/poster.png',
        mimetype: 'image/png',
        size: 12,
      }),
    ).toEqual({
      fileName: 'poster.png',
      byteSize: 12,
      contentType: 'image/png',
    });
  });

  it('rejects an empty file and a traversal name', () => {
    expect(readUploadMeta({ originalname: 'poster.png', size: 0 })).toBeNull();
    expect(
      readUploadMeta({ originalname: '..', mimetype: 'image/png', size: 4 }),
    ).toBeNull();
  });
});

describe('readIdempotencyKey', () => {
  it('accepts a short token and rejects spaces', () => {
    expect(readIdempotencyKey('spring-1')).toEqual({ ok: true, key: 'spring-1' });
    expect(readIdempotencyKey('spring 1')).toEqual({ ok: false });
    expect(readIdempotencyKey(undefined)).toEqual({ ok: true, key: null });
  });
});

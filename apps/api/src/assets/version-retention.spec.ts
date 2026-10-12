import { describe, expect, it } from 'vitest';
import { retireDriveFiles } from './version-retention.js';

const v1 = { id: 'v1', driveFileId: 'file-1' };
const v2 = { id: 'v2', driveFileId: 'file-2' };

describe('version retention', () => {
  it('keeps the approved file while a replacement is not the stored approved version', () => {
    expect(retireDriveFiles({ approvedVersionId: 'v1', versions: [v1, v2] })).toEqual([
      { versionId: 'v2', driveFileId: 'file-2' },
    ]);
    expect(
      retireDriveFiles({
        approvedVersionId: 'v2',
        versions: [v1, { id: 'v2', driveFileId: null }],
      }),
    ).toEqual([]);
  });

  it('retires the previous file only when the replacement file is the active approved version', () => {
    expect(retireDriveFiles({ approvedVersionId: 'v2', versions: [v1, v2] })).toEqual([
      { versionId: 'v1', driveFileId: 'file-1' },
    ]);
    expect(
      retireDriveFiles({
        approvedVersionId: 'v2',
        versions: [v1, { id: 'v2', driveFileId: 'file-1' }],
      }),
    ).toEqual([]);
  });
});

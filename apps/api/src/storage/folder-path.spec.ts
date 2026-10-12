import { describe, expect, it } from 'vitest';
import { folderPath, isSafeSegment } from './folder-path.js';

describe('folderPath', () => {
  it('builds the shared-drive path from stored names', () => {
    expect(
      folderPath({
        companyCode: 'SAPL',
        departmentName: 'Brand',
        year: 2026,
        campaign: 'Spring',
        stage: 'working',
        assetType: 'posters',
      }),
    ).toBe('AARADHYA_DAM/SAPL/Brand/2026/Spring/01_Working/Posters');
  });

  it('rejects a segment that could change the path', () => {
    expect(isSafeSegment('../Secret')).toBe(false);
    expect(isSafeSegment('Brand/Other')).toBe(false);
    expect(isSafeSegment('Brand')).toBe(true);
  });
});

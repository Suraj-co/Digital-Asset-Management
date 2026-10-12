import { folderSegments, setEnvLine } from './google-workspace.js';

describe('google workspace helpers', () => {
  it('drops the Drive root from a catalog path', () => {
    expect(
      folderSegments('AARADHYA_DAM/SAPL/Brand/2026/Spring/01_Working/Posters'),
    ).toEqual(['SAPL', 'Brand', '2026', 'Spring', '01_Working', 'Posters']);
  });

  it('replaces an existing env line without keeping a comment marker', () => {
    const next = setEnvLine('# GOOGLE_SHEETS_ID=\nGOOGLE_CLIENT_ID=\n', 'GOOGLE_SHEETS_ID', 'sheet-1');
    expect(next).toContain('GOOGLE_SHEETS_ID=sheet-1');
    expect(next).not.toContain('# GOOGLE_SHEETS_ID=');
  });
});

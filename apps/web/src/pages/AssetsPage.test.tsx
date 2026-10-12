import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { AssetsPage } from '@/pages/AssetsPage';

function renderPage(path = '/assets') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="assets" element={<AssetsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const session = {
  user: { id: 'user-1', email: 'person@example.com', status: 'active' },
  expiresAt: '2026-10-10T17:40:00.000Z',
};

const sapl = {
  id: '4b4c0002-0000-4000-8000-000000000002',
  code: 'SAPL',
  name: 'SAPL',
  active: true,
  roles: ['creator'],
};

const failed = {
  id: 'asset-1',
  companyId: sapl.id,
  companyCode: 'SAPL',
  folderId: 'folder-1',
  path: 'AARADHYA_DAM/SAPL/Brand/2026/Spring/01_Working/Posters',
  code: 'SAPL-0001',
  title: 'Spring poster',
  state: 'upload_failed',
  fileName: 'poster.png',
  byteSize: 5,
  contentType: 'image/png',
  driveFileId: null,
  failureClass: 'not_configured',
  detail:
    'Google Drive was not called. The file was not stored. Send it again after Drive is configured.',
  createdAt: '2026-10-10T06:00:00.000Z',
  updatedAt: '2026-10-10T06:00:00.000Z',
  workflowStage: 'draft' as const,
  publication: 'not_started' as const,
  actions: ['submit'] as const,
  decisions: [],
  versions: [
    {
      id: 'version-1',
      number: 1,
      label: 'v001',
      fileName: 'poster.png',
      byteSize: 5,
      contentType: 'image/png',
      state: 'upload_failed' as const,
      driveFileId: null,
      failureClass: 'not_configured' as const,
      detail:
        'Google Drive was not called. The file was not stored. Send it again after Drive is configured.',
      createdAt: '2026-10-10T06:00:00.000Z',
    },
  ],
};

describe('AssetsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('asks a signed-out person to sign in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ message: 'Sign in is required.' }),
      }),
    );
    renderPage();
    expect(await screen.findByText('Sign in is required')).toBeInTheDocument();
    expect(screen.getByText(/file is not stored/)).toBeInTheDocument();
  });

  it('shows a failed upload and does not claim the file was stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/v1/assets') && init?.method === 'POST') {
          return { status: 201, ok: true, json: async () => failed };
        }
        if (url.includes('/storage/folders')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 'folder-1',
                  companyId: sapl.id,
                  companyCode: 'SAPL',
                  departmentId: 'dept-1',
                  departmentName: 'Brand',
                  year: 2026,
                  campaign: 'Spring',
                  stage: 'working',
                  assetType: 'posters',
                  path: failed.path,
                  driveFolderId: null,
                  liveCheck: 'not_run',
                  detail: 'Google Drive was not called.',
                },
              ],
              total: 1,
              limit: 100,
              offset: 0,
            }),
          };
        }
        if (url.includes('/api/v1/assets')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
          };
        }
        if (url.includes('/api/v1/companies')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [sapl], total: 1, limit: 100, offset: 0 }),
          };
        }
        return { status: 200, ok: true, json: async () => session };
      }),
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Record an upload' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Spring poster' } });
    const file = new File(['hello'], 'poster.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Record upload' }));
    expect(await screen.findByText(/Google Drive was not called/)).toBeInTheDocument();
    expect(screen.getByText('SAPL-0001 · Upload failed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
  });

  it('requests matches for the search text', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/storage/folders')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'folder-1',
                companyId: sapl.id,
                companyCode: 'SAPL',
                departmentId: 'dept-1',
                departmentName: 'Brand',
                year: 2026,
                campaign: 'Spring',
                stage: 'working',
                assetType: 'posters',
                path: failed.path,
                driveFolderId: null,
                liveCheck: 'not_run',
                detail: 'Google Drive was not called.',
              },
            ],
            total: 1,
            limit: 100,
            offset: 0,
          }),
        };
      }
      if (url.includes('/api/v1/assets')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ items: [failed], total: 1, limit: 100, offset: 0 }),
        };
      }
      if (url.includes('/api/v1/companies')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ items: [sapl], total: 1, limit: 100, offset: 0 }),
        };
      }
      return { status: 200, ok: true, json: async () => session };
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage('/assets?q=Spring');
    expect(await screen.findByRole('link', { name: 'SAPL-0001' })).toHaveAttribute(
      'href',
      '/assets/asset-1',
    );
    expect(screen.getByText(/Matches for “Spring”/)).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
    const assetCall = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes('/api/v1/assets'));
    expect(assetCall).toContain('q=Spring');
  });
});
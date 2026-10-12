import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { AssetDetailPage } from '@/pages/AssetDetailPage';

const session = {
  user: { id: 'user-1', email: 'person@example.com', status: 'active' },
  expiresAt: '2026-10-10T17:40:00.000Z',
};

const asset = {
  id: 'asset-1',
  companyId: '4b4c0002-0000-4000-8000-000000000002',
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

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/assets/asset-1']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="assets/:assetId" element={<AssetDetailPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AssetDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows metadata and says there is no preview', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/v1/assets/asset-1/transitions') && init?.method === 'POST') {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              ...asset,
              workflowStage: 'scope_analysis',
              actions: [],
              decisions: [
                {
                  id: 'decision-1',
                  versionId: 'version-1',
                  versionLabel: 'v001',
                  action: 'submit',
                  fromStage: 'draft',
                  toStage: 'scope_analysis',
                  reason: null,
                  detail: 'Submitted the latest version. The file is not stored.',
                  actorEmail: 'person@example.com',
                  createdAt: '2026-10-10T06:01:00.000Z',
                },
              ],
            }),
          };
        }
        if (url.endsWith('/api/v1/assets/asset-1/versions') && init?.method === 'POST') {
          return {
            status: 201,
            ok: true,
            json: async () => ({
              ...asset,
              fileName: 'second.png',
              versions: [
                ...asset.versions,
                {
                  ...asset.versions[0],
                  id: 'version-2',
                  number: 2,
                  label: 'v002',
                  fileName: 'second.png',
                },
              ],
            }),
          };
        }
        if (url.endsWith('/api/v1/assets/asset-1') && init?.method === 'PATCH') {
          return {
            status: 200,
            ok: true,
            json: async () => ({ ...asset, title: 'Spring revised' }),
          };
        }
        if (url.includes('/api/v1/assets/asset-1')) {
          return { status: 200, ok: true, json: async () => asset };
        }
        if (url.includes('/api/v1/companies')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
          };
        }
        return { status: 200, ok: true, json: async () => session };
      }),
    );
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'SAPL-0001' })).toBeInTheDocument();
    expect(screen.getByText('No preview. The file was not stored.')).toBeInTheDocument();
    expect(screen.getByText('v001')).toBeInTheDocument();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(
      await screen.findByText('Submitted the latest version. The file is not stored.'),
    ).toBeInTheDocument();
    const file = new File(['next'], 'second.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Record another version' }));
    expect(await screen.findByText('v002 recorded. The file was not stored.')).toBeInTheDocument();
    expect(screen.getAllByText('Not stored').length).toBeGreaterThan(0);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Spring revised' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save title' }));
    expect(await screen.findByText('Title saved. The file is still not stored.')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { FoldersPage } from '@/pages/FoldersPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/folders']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="folders" element={<FoldersPage />} />
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

describe('FoldersPage', () => {
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
    expect(screen.getByText(/does not call Google Drive/)).toBeInTheDocument();
  });

  it('shows a stored path and does not invent a Drive id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/departments') && init?.method === 'POST') {
          return { status: 403, ok: false, json: async () => ({ message: 'no' }) };
        }
        if (url.includes('/storage/folders/resolve') && init?.method === 'POST') {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              id: 'folder-1',
              companyId: sapl.id,
              companyCode: 'SAPL',
              departmentId: 'dept-1',
              departmentName: 'Brand',
              year: 2026,
              campaign: 'Spring',
              stage: 'working',
              assetType: 'posters',
              path: 'AARADHYA_DAM/SAPL/Brand/2026/Spring/01_Working/Posters',
              driveFolderId: null,
              liveCheck: 'not_run',
              detail:
                'The folder row was stored. Google Drive was not called. No Drive folder id was stored.',
            }),
          };
        }
        if (url.includes('/departments')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              items: [{ id: 'dept-1', companyId: sapl.id, name: 'Brand', active: true }],
              total: 1,
              limit: 100,
              offset: 0,
            }),
          };
        }
        if (url.includes('/storage/folders')) {
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
    expect(await screen.findByRole('heading', { name: 'Record a folder path' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add a department' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect Google Drive' })).toHaveAttribute(
      'href',
      '/api/v1/storage/oauth/start',
    );
    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'Spring' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record folder path' }));
    expect(
      await screen.findByText('AARADHYA_DAM/SAPL/Brand/2026/Spring/01_Working/Posters'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Google Drive was not called/)).toBeInTheDocument();
    expect(screen.queryByText(/drive-folder/i)).not.toBeInTheDocument();
  });
});
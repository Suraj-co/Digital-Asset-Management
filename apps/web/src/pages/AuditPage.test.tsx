import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { AuditPage } from '@/pages/AuditPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/audit']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="audit" element={<AuditPage />} />
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
  roles: ['admin'],
};

describe('AuditPage', () => {
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
    expect(screen.getByText(/No file is stored/)).toBeInTheDocument();
    expect(screen.getByText(/not copied here/)).toBeInTheDocument();
  });

  it('shows the server refusal when the caller is not an admin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/audit-events')) {
          return {
            status: 403,
            ok: false,
            json: async () => ({ message: 'You do not have access to manage this company.' }),
          };
        }
        if (url.includes('/api/v1/companies')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              items: [{ ...sapl, roles: ['creator'] }],
              total: 1,
              limit: 100,
              offset: 0,
            }),
          };
        }
        if (url.includes('/api/v1/notifications')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, unread: 0, limit: 20, offset: 0 }),
          };
        }
        return { status: 200, ok: true, json: async () => session };
      }),
    );
    renderPage();
    expect(
      await screen.findByText('You do not have access to manage this company.'),
    ).toBeInTheDocument();
  });

  it('shows a stored sentence for an admin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/audit-events')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 'audit-1',
                  companyCode: 'SAPL',
                  actorEmail: 'person@example.com',
                  action: 'task_planned',
                  summary: 'person@example.com planned "Label the poster".',
                  subjectType: 'task',
                  subjectId: 'task-1',
                  createdAt: '2026-10-10T13:24:00.000Z',
                },
              ],
              total: 21,
              limit: 20,
              offset: 0,
            }),
          };
        }
        if (url.includes('/api/v1/companies')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [sapl], total: 1, limit: 100, offset: 0 }),
          };
        }
        if (url.includes('/api/v1/notifications')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, unread: 0, limit: 20, offset: 0 }),
          };
        }
        return { status: 200, ok: true, json: async () => session };
      }),
    );
    renderPage();
    expect(
      await screen.findByText('person@example.com planned "Label the poster".'),
    ).toBeInTheDocument();
    expect(screen.getByText('This list is the latest rows.')).toBeInTheDocument();
    expect(screen.queryByText(/driveFileId/)).not.toBeInTheDocument();
  });
});

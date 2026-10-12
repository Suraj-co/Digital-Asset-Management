import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { NotificationsPage } from '@/pages/NotificationsPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const session = {
  user: { id: 'user-1', email: 'person@example.com', status: 'active' },
  expiresAt: '2026-10-10T17:40:00.000Z',
};

const assigned = {
  id: 'note-1',
  companyCode: 'SAPL',
  kind: 'task_assigned' as const,
  body: 'mate@example.com assigned "Crop the poster".',
  href: '/tasks',
  readAt: null,
  createdAt: '2026-10-10T06:00:00.000Z',
};

describe('NotificationsPage', () => {
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
    expect(await screen.findByRole('heading', { name: 'Sign in is required' })).toBeInTheDocument();
    expect(screen.getByText(/available after a server session/)).toBeInTheDocument();
    expect(screen.getAllByText(/email copy is queued/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/emailSent/)).not.toBeInTheDocument();
  });

  it('shows an empty inbox', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/notifications')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, unread: 0, limit: 20, offset: 0 }),
          };
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
    renderPage();
    expect(await screen.findByText('No notifications')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is waiting/)).toBeInTheDocument();
  });

  it('shows the latest rows and a mark-read control', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/notifications')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [assigned], total: 21, unread: 1, limit: 20, offset: 0 }),
          };
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
    renderPage();
    expect(await screen.findByText(assigned.body)).toBeInTheDocument();
    expect(screen.getByText('SAPL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark read' })).toBeInTheDocument();
    expect(screen.getByText('This list is the latest rows.')).toBeInTheDocument();
    expect(screen.queryByText(/emailSent/)).not.toBeInTheDocument();
  });
});

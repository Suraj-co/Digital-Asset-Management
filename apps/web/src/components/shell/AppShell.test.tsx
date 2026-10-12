import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { DesignSystemPage } from '@/pages/DesignSystemPage';

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<h1>Environment status</h1>} />
          <Route path="design-system" element={<DesignSystemPage />} />
          <Route path="assets" element={<h1>Assets</h1>} />
          <Route path="*" element={<h1>Page not available</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function openControl(name: string) {
  const button = screen.getByRole('button', { name });
  fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
  fireEvent.click(button);
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ message: 'Sign in is required.' }),
      }),
    );
  });

  it('navigates between the environment page and the design system', () => {
    renderShell();
    fireEvent.click(screen.getByRole('link', { name: 'Design system' }));
    expect(
      screen.getByRole('heading', { name: 'Design system' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
  });

  it('asks a signed-out person to sign in before listing companies', async () => {
    renderShell();
    expect(screen.getByRole('button', { name: 'Company' })).toHaveTextContent(
      'No company',
    );
    openControl('Company');
    const menu = screen.getByRole('menu', { name: 'Company' });
    expect(
      await within(menu).findByText(/Sign in to see company membership/),
    ).toBeInTheDocument();
    expect(within(menu).getByText(/does not grant access/)).toBeInTheDocument();
    expect(within(menu).queryByText('BAPL')).not.toBeInTheDocument();
    expect(within(menu).queryByText('ASEDS')).not.toBeInTheDocument();
  });

  it('lists Ontale after that membership is returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/companies')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              items: [
                {
                  id: '4b4c0005-0000-4000-8000-000000000005',
                  code: 'Ontale',
                  name: 'Ontale',
                  active: true,
                  roles: ['creator'],
                },
              ],
              total: 1,
              limit: 100,
              offset: 0,
            }),
          };
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({
            user: {
              id: 'user-1',
              email: 'person@example.com',
              status: 'active',
            },
            expiresAt: '2026-10-10T17:40:00.000Z',
          }),
        };
      }),
    );
    renderShell();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Company' })).toHaveTextContent('Ontale');
    });
    openControl('Company');
    const menu = screen.getByRole('menu', { name: 'Company' });
    expect(within(menu).getByText('Ontale')).toBeInTheDocument();
    expect(within(menu).queryByText('BAPL')).not.toBeInTheDocument();
    expect(
      within(menu).getByText(/does not grant access/),
    ).toBeInTheDocument();
  });

  it('asks a signed-out person to sign in before listing notices', () => {
    renderShell();
    openControl('Notifications');
    const menu = screen.getByRole('menu', { name: 'Notifications' });
    expect(within(menu).getByText('Sign in is required')).toBeInTheDocument();
    expect(within(menu).getByText(/after a server session/)).toBeInTheDocument();
    expect(within(menu).getByText(/email copy is queued/)).toBeInTheDocument();
    expect(within(menu).queryByText(/Module 13/)).not.toBeInTheDocument();
  });

  it('shows one unread notice on the bell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/notifications')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 'note-1',
                  companyCode: 'SAPL',
                  kind: 'task_assigned',
                  body: 'mate@example.com assigned "Crop the poster".',
                  href: '/tasks',
                  readAt: null,
                  createdAt: '2026-10-10T06:00:00.000Z',
                },
              ],
              total: 1,
              unread: 1,
              limit: 20,
              offset: 0,
            }),
          };
        }
        if (url.includes('/api/v1/companies')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
          };
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({
            user: { id: 'user-1', email: 'person@example.com', status: 'active' },
            expiresAt: '2026-10-10T17:40:00.000Z',
          }),
        };
      }),
    );
    renderShell();
    const button = await screen.findByRole('button', { name: /1 unread/ });
    fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
    fireEvent.click(button);
    expect(screen.getByText('mate@example.com assigned "Crop the poster".')).toBeInTheDocument();
    expect(screen.getByText('SAPL')).toBeInTheDocument();
  });

  it('shows that no session exists', () => {
    renderShell();
    expect(screen.getByRole('button', { name: 'Not signed in' })).toBeInTheDocument();
    openControl('Not signed in');
    expect(
      within(screen.getByRole('menu')).getByText(/does not collect a password/),
    ).toBeInTheDocument();
    expect(within(screen.getByRole('menu')).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('searches asset codes, titles, and file names', () => {
    renderShell();
    const search = screen.getByLabelText('Search');
    expect(search).toBeEnabled();
    fireEvent.change(search, { target: { value: 'SAPL-0001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('heading', { name: 'Assets' })).toBeInTheDocument();
  });

  it('opens navigation on a narrow layout', () => {
    renderShell();
    openControl('Open navigation');
    const dialog = screen.getByRole('dialog', { name: 'Aaradhya DAM' });
    expect(within(dialog).getByRole('link', { name: 'Environment' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('link', { name: 'Design system' }));
    expect(screen.getByRole('heading', { name: 'Design system' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

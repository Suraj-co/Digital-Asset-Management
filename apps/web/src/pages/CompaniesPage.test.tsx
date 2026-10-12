import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { CompaniesPage } from '@/pages/CompaniesPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/companies']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="companies" element={<CompaniesPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const session = {
  user: { id: 'user-1', email: 'admin@example.com', status: 'active' },
  expiresAt: '2026-10-10T17:40:00.000Z',
};

const ontale = {
  id: '4b4c0005-0000-4000-8000-000000000005',
  code: 'Ontale',
  name: 'Ontale',
  active: true,
  roles: ['admin'],
};

describe('CompaniesPage', () => {
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
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByText(/BAPL, SAPL, GBAPL, KABPL, and Ontale/)).toBeInTheDocument();
    expect(screen.queryByText('ASEDS')).not.toBeInTheDocument();
  });

  it('shows Ontale after a grant and does not list BAPL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/memberships') && init?.method === 'POST') {
          return {
            status: 201,
            ok: true,
            json: async () => ({
              id: 'membership-1',
              userId: 'user-2',
              email: 'person@example.com',
              companyId: ontale.id,
              companyCode: 'Ontale',
              role: 'creator',
            }),
          };
        }
        if (url.includes('/creator-invitations')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [] }),
          };
        }
        if (url.includes('/api/v1/users')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, limit: 20, offset: 0 }),
          };
        }
        if (url.includes('/api/v1/companies')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [ontale], total: 1, limit: 100, offset: 0 }),
          };
        }
        return { status: 200, ok: true, json: async () => session };
      }),
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Grant access in Ontale' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Grant access in BAPL' })).not.toBeInTheDocument();
    expect(screen.getByText('Selected in this tab')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Grant membership' }));
    expect(await screen.findByText('Ontale membership granted.')).toBeInTheDocument();
  });
});

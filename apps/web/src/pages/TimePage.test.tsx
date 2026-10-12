import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { TimePage } from '@/pages/TimePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/time']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="time" element={<TimePage />} />
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

const recorded = {
  id: 'time-1',
  companyId: sapl.id,
  companyCode: 'SAPL',
  userId: 'user-1',
  userEmail: 'person@example.com',
  taskId: null,
  taskTitle: null,
  workDate: '2026-10-10',
  minutes: 90,
  note: '',
  status: 'open' as const,
  reviewReason: null,
  actions: ['submit' as const],
  createdAt: '2026-10-10T06:00:00.000Z',
  updatedAt: '2026-10-10T06:00:00.000Z',
};

describe('TimePage', () => {
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
    expect(screen.getByText(/Minutes are the number you enter/)).toBeInTheDocument();
    expect(screen.getByText(/payroll total is on the dashboard/)).toBeInTheDocument();
  });

  it('records the minutes that were entered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/v1/time-entries') && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { minutes: number };
          return { status: 201, ok: true, json: async () => ({ ...recorded, minutes: body.minutes }) };
        }
        if (url.includes('/api/v1/time-entries')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
          };
        }
        if (url.includes('/api/v1/tasks')) {
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
    expect(await screen.findByRole('heading', { name: 'Record time' })).toBeInTheDocument();
    expect(screen.getByText(/You see your own entries/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record time' }));
    expect(await screen.findByText('90 minutes recorded. The payroll total is on the dashboard.')).toBeInTheDocument();
    expect(screen.queryByText(/hours/i)).not.toBeInTheDocument();
  });
});

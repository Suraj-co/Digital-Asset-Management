import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { TasksPage } from '@/pages/TasksPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="tasks" element={<TasksPage />} />
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

const planned = {
  id: 'task-1',
  companyId: sapl.id,
  companyCode: 'SAPL',
  title: 'Crop the poster',
  detail: '',
  status: 'open' as const,
  deadline: null,
  priority: null,
  assetId: null,
  assetCode: null,
  assigneeId: null,
  assigneeEmail: null,
  createdByEmail: 'person@example.com',
  createdAt: '2026-10-10T06:00:00.000Z',
  updatedAt: '2026-10-10T06:00:00.000Z',
};

describe('TasksPage', () => {
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
    expect(screen.getByText(/does not record time/)).toBeInTheDocument();
  });

  it('adds a task and says time was not recorded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/v1/tasks') && init?.method === 'POST') {
          return { status: 201, ok: true, json: async () => planned };
        }
        if (url.includes('/api/v1/tasks')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
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
    expect(await screen.findByRole('heading', { name: 'Add a task' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Crop the poster' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(await screen.findByText('Crop the poster added. Time was not recorded.')).toBeInTheDocument();
    expect(screen.queryByText(/hours/i)).not.toBeInTheDocument();
  });
});

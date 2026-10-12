import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="dashboard" element={<DashboardPage />} />
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

const counts = {
  companyId: sapl.id,
  companyCode: 'SAPL',
  scope: 'own' as const,
  assets: {
    total: 1,
    uploadFailed: 1,
    publicationNotStarted: 1,
    publicationNotRun: 0,
    publicationReady: 0,
    byStage: {
      draft: 1,
      scope_analysis: 0,
      rm_qc: 0,
      rm_approval: 0,
      admin_qc: 0,
      admin_approval: 0,
      changes_requested: 0,
    },
  },
  queues: {
    drafts: 1,
    rmReview: 0,
    changesRequested: 0,
    adminReview: 0,
    readyToPublish: 0,
  },
  tasks: { open: 1, done: 0 },
  time: { open: 1, submitted: 0, accepted: 0, returned: 0, minutes: 90 },
  payroll: {
    acceptedMinutes: 0,
    hourlyRateMinor: null,
    currency: 'INR' as const,
    amountMinor: null,
    detail:
      'No hourly rate is set. An admin sets the company rate before a payroll total is calculated.',
  },
};

describe('DashboardPage', () => {
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
    expect(screen.getByText(/Counts are stored rows/)).toBeInTheDocument();
    expect(screen.getByText(/company hourly rate/)).toBeInTheDocument();
  });

  it('shows the caller’s own stored counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/dashboard')) {
          return { status: 200, ok: true, json: async () => counts };
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
    expect(await screen.findByText(/You see your own rows/)).toBeInTheDocument();
    expect(screen.getByText(/Sum of stored minutes: 90/)).toBeInTheDocument();
    expect(screen.getByText('Payroll total')).toBeInTheDocument();
    expect(screen.getByText('Not calculated')).toBeInTheDocument();
    expect(screen.getByText('Upload failed')).toBeInTheDocument();
    expect(screen.getByText('Assets by stage')).toBeInTheDocument();
    expect(screen.getByText('An admin sets the hourly rate.')).toBeInTheDocument();
  });
});
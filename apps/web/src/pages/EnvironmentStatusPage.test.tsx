import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HealthReport } from '../api/health.ts';
import { EnvironmentStatusView } from './EnvironmentStatusPage.tsx';

const healthy: HealthReport = {
  status: 'ok',
  service: 'aaradhya-dam-api',
  version: '0.1.0',
  timestamp: '2026-10-10T04:41:00.000Z',
  correlationId: 'trace-42',
  checks: {
    api: { status: 'up' },
    database: { status: 'up', latencyMs: 4, category: null },
    redis: { status: 'up', latencyMs: 2 },
  },
};

describe('EnvironmentStatusView', () => {
  it('shows a checking state', () => {
    render(
      <EnvironmentStatusView state={{ kind: 'loading' }} onRefresh={() => {}} />,
    );
    expect(screen.getAllByText('Checking').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
  });

  it('shows a healthy API and database', () => {
    render(
      <EnvironmentStatusView
        state={{ kind: 'report', report: healthy }}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText('trace-42')).toBeInTheDocument();
    expect(screen.getByText(/This page does not deploy/)).toBeInTheDocument();
    expect(screen.getByText('4 ms')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows a degraded database without hiding the API', () => {
    render(
      <EnvironmentStatusView
        state={{
          kind: 'report',
          report: {
            ...healthy,
            status: 'degraded',
            checks: {
              api: { status: 'up' },
              database: {
                status: 'down',
                latencyMs: null,
                category: 'connection_refused',
              },
              redis: { status: 'not_configured', latencyMs: null },
            },
          },
        }}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText('connection_refused')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getAllByText('Up').length).toBeGreaterThan(0);
  });

  it('shows a refused client without marking PostgreSQL down', () => {
    render(
      <EnvironmentStatusView
        state={{
          kind: 'limited',
          detail: 'Too many requests from this client. Try again later.',
        }}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getAllByText('Limited').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Too many requests from this client. Try again later.').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.queryByText('Down')).not.toBeInTheDocument();
  });

  it('shows an unreachable API', () => {
    render(
      <EnvironmentStatusView
        state={{ kind: 'unreachable', detail: 'The API did not respond.' }}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getAllByText('The API did not respond.').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('calls refresh when requested', async () => {
    const onRefresh = vi.fn();
    render(
      <EnvironmentStatusView
        state={{ kind: 'report', report: healthy }}
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

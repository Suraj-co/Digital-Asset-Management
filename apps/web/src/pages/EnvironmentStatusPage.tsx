import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import {
  fetchHealthReport,
  HealthContractError,
  HealthLimitError,
  HealthRequestError,
  type HealthReport,
} from '../api/health.ts';

export type StatusViewState =
  | { kind: 'loading' }
  | { kind: 'unreachable'; detail: string }
  | { kind: 'invalid'; detail: string }
  | { kind: 'limited'; detail: string }
  | { kind: 'report'; report: HealthReport };

function stateFromError(error: unknown): StatusViewState {
  if (error instanceof HealthLimitError) {
    return { kind: 'limited', detail: error.message };
  }
  if (error instanceof HealthRequestError) {
    return { kind: 'unreachable', detail: error.message };
  }
  if (error instanceof HealthContractError) {
    return { kind: 'invalid', detail: error.message };
  }
  return { kind: 'unreachable', detail: 'The API could not be reached.' };
}

type StatusTone = 'ok' | 'bad' | 'warn' | 'pending';

function toneClasses(tone: StatusTone): string {
  if (tone === 'ok') {
    return 'bg-ok-bg text-ok';
  }
  if (tone === 'bad') {
    return 'bg-bad-bg text-bad';
  }
  if (tone === 'warn') {
    return 'bg-warn-bg text-warn';
  }
  return 'bg-muted text-muted-foreground';
}

function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      className={`inline-flex min-w-16 justify-center rounded px-2 py-0.5 text-xs font-semibold ${toneClasses(tone)}`}
    >
      {label}
    </span>
  );
}

export function EnvironmentStatusView({
  state,
  onRefresh,
}: {
  state: StatusViewState;
  onRefresh: () => void;
}) {
  const refreshing = state.kind === 'loading';
  const report = state.kind === 'report' ? state.report : null;
  const database = report?.checks.database;

  return (
    <div>
      <PageHeader
        title="Environment status"
        description="Confirms that this page can reach the API, PostgreSQL, and Redis. Redis queues email copies. A client that calls too often is refused. This page does not show that counter. A backup is a database dump an operator runs outside this page. This page does not deploy."
        actions={
          <Button type="button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Checking…' : 'Refresh status'}
          </Button>
        }
      />

      <section
        aria-live="polite"
        className="mt-6 overflow-hidden rounded-lg border border-border bg-card"
      >
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">
                Service
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Status
              </th>
              <th scope="col" className="hidden px-4 py-2 font-semibold sm:table-cell">
                Detail
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <th scope="row" className="px-4 py-3 font-medium">
                Web app
              </th>
              <td className="px-4 py-3">
                <StatusPill tone="ok" label="Up" />
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                This page is loaded
              </td>
            </tr>
            <tr className="border-b border-border">
              <th scope="row" className="px-4 py-3 font-medium">
                API
              </th>
              <td className="px-4 py-3">
                {state.kind === 'loading' ? (
                  <StatusPill tone="pending" label="Checking" />
                ) : state.kind === 'report' ? (
                  <StatusPill tone="ok" label="Up" />
                ) : state.kind === 'limited' ? (
                  <StatusPill tone="warn" label="Limited" />
                ) : (
                  <StatusPill tone="bad" label="Down" />
                )}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {state.kind === 'report'
                  ? `${report?.service} ${report?.version}`
                  : state.kind === 'loading'
                    ? 'Waiting for /api/v1/health'
                    : state.detail}
              </td>
            </tr>
            <tr className="border-b border-border">
              <th scope="row" className="px-4 py-3 font-medium">
                PostgreSQL
              </th>
              <td className="px-4 py-3">
                {state.kind === 'loading' ? (
                  <StatusPill tone="pending" label="Checking" />
                ) : database?.status === 'up' ? (
                  <StatusPill tone="ok" label="Up" />
                ) : state.kind === 'report' ? (
                  <StatusPill tone="bad" label="Down" />
                ) : (
                  <StatusPill tone="warn" label="Unknown" />
                )}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {database?.status === 'up'
                  ? `${database.latencyMs} ms`
                  : database?.status === 'down'
                    ? (database.category ?? 'unavailable')
                    : 'Not checked'}
              </td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-medium">
                Redis
              </th>
              <td className="px-4 py-3">
                {state.kind === 'loading' ? (
                  <StatusPill tone="pending" label="Checking" />
                ) : report?.checks.redis.status === 'up' ? (
                  <StatusPill tone="ok" label="Up" />
                ) : report?.checks.redis.status === 'down' ? (
                  <StatusPill tone="bad" label="Down" />
                ) : report?.checks.redis.status === 'not_configured' ? (
                  <StatusPill tone="warn" label="Not configured" />
                ) : (
                  <StatusPill tone="warn" label="Unknown" />
                )}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {report?.checks.redis.status === 'up'
                  ? `${report.checks.redis.latencyMs} ms. Email copies queue here.`
                  : report?.checks.redis.status === 'down'
                    ? 'Email copies stay in the app until Redis answers.'
                    : report?.checks.redis.status === 'not_configured'
                      ? 'Set REDIS_URL to queue email copies.'
                      : 'Not checked'}
              </td>
            </tr>
          </tbody>
        </table>
        {state.kind !== 'report' && state.kind !== 'loading' ? (
          <p className="border-t border-border px-4 py-3 text-sm text-bad sm:hidden">
            {state.detail}
          </p>
        ) : null}
      </section>

      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Checked at
          </dt>
          <dd className="mt-1 font-medium">{report?.timestamp ?? 'Not checked'}</dd>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Correlation ID
          </dt>
          <dd className="mt-1 break-all font-mono text-xs">
            {report?.correlationId ?? '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Overall
          </dt>
          <dd className="mt-1 font-medium">
            {state.kind === 'loading'
              ? 'Checking'
              : state.kind === 'report'
                ? report?.status === 'ok'
                  ? 'Ready'
                  : 'Degraded'
                : state.kind === 'limited'
                  ? 'Limited'
                  : 'Unavailable'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function EnvironmentStatusPage() {
  const [state, setState] = useState<StatusViewState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const report = await fetchHealthReport();
      setState({ kind: 'report', report });
    } catch (error) {
      setState(stateFromError(error));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchHealthReport()
      .then((report) => {
        if (active) {
          setState({ kind: 'report', report });
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setState(stateFromError(error));
      });
    return () => {
      active = false;
    };
  }, []);

  return <EnvironmentStatusView state={state} onRefresh={() => void load()} />;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { CompanyRequestError, setPayRate } from '@/api/companies';
import { fetchDashboard, type Dashboard } from '@/api/dashboard';
import { CountChart } from '@/components/shell/CountChart';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/shell/company-context';
import { useSession } from '@/shell/session-context';

const STAGE_LABELS: { key: keyof Dashboard['assets']['byStage']; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'scope_analysis', label: 'Scope' },
  { key: 'rm_qc', label: 'RM QC' },
  { key: 'rm_approval', label: 'RM approval' },
  { key: 'admin_qc', label: 'Admin QC' },
  { key: 'admin_approval', label: 'Admin approval' },
  { key: 'changes_requested', label: 'Changes' },
];

const PAGE_DESCRIPTION =
  'Counts are stored rows. The payroll total uses accepted minutes and the company hourly rate. No file is stored.';

export function DashboardPage() {
  const { session, ready } = useSession();
  const company = useCompany();
  const selected = company.selected;
  const dashboard = useQuery({
    queryKey: ['dashboard', selected?.id],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchDashboard(selected!.id),
  });

  if (!ready || (session && !company.ready)) {
    return <LoadingState label="Loading company membership." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description={PAGE_DESCRIPTION} />
        <EmptyState
          title="Sign in is required"
          description="Dashboard counts are available after a server session."
        />
        <Link to="/sign-in" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description={PAGE_DESCRIPTION} />
        <EmptyState
          title="No company membership"
          description="An admin of a company has to grant access before counts can be shown."
        />
      </div>
    );
  }
  if (dashboard.isLoading) {
    return <LoadingState label="Loading dashboard counts." />;
  }
  if (dashboard.error || !dashboard.data) {
    return (
      <ErrorState
        title="Dashboard counts are unavailable"
        detail={messageFrom(dashboard.error)}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const counts = dashboard.data;
  const scopeSentence =
    counts.scope === 'company'
      ? 'You see this company’s administrative rows.'
      : counts.scope === 'review'
        ? 'You see your tasks and submissions waiting for your review.'
        : 'You see your own rows.';
  const isAdmin = selected.roles.includes('admin');

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Dashboard"
        description={`${counts.companyCode}. ${PAGE_DESCRIPTION} ${scopeSentence}`}
      />
      <section className="max-w-3xl space-y-3 rounded-lg border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-semibold">Assets</h2>
        <p className="text-sm text-muted-foreground">
          Upload failed means the file was not stored. Publication has not moved a file.
        </p>
        <CountChart
          title="Assets by stage"
          data={STAGE_LABELS.map((stage) => ({
            label: stage.label,
            value: counts.assets.byStage[stage.key],
          }))}
        />
        <CountList
          rows={[
            { label: 'Assets', value: counts.assets.total },
            { label: 'Upload failed', value: counts.assets.uploadFailed },
            { label: 'Publication not started', value: counts.assets.publicationNotStarted },
            { label: 'Publication not run', value: counts.assets.publicationNotRun },
            { label: 'Ready to publish', value: counts.queues.readyToPublish },
            { label: 'Drafts', value: counts.queues.drafts },
            { label: 'RM review', value: counts.queues.rmReview },
            { label: 'Changes requested', value: counts.queues.changesRequested },
            { label: 'Admin review', value: counts.queues.adminReview },
          ]}
        />
        <Link to="/assets" className="inline-block text-sm font-medium underline">
          View assets
        </Link>
      </section>
      <section className="max-w-3xl space-y-3 rounded-lg border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-semibold">Tasks</h2>
        <p className="text-sm text-muted-foreground">
          A task count is a plan. It does not include minutes.
        </p>
        <CountChart
          title="Tasks"
          data={[
            { label: 'Open', value: counts.tasks.open },
            { label: 'Done', value: counts.tasks.done },
          ]}
        />
        <Link to="/tasks" className="inline-block text-sm font-medium underline">
          View tasks
        </Link>
      </section>
      <section className="max-w-3xl space-y-3 rounded-lg border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-semibold">Time</h2>
        <p className="text-sm text-muted-foreground">
          Sum of stored minutes: {counts.time.minutes}. The payroll total below uses accepted
          minutes only.
        </p>
        <CountChart
          title="Time entries"
          data={[
            { label: 'Open', value: counts.time.open },
            { label: 'Submitted', value: counts.time.submitted },
            { label: 'Accepted', value: counts.time.accepted },
            { label: 'Returned', value: counts.time.returned },
          ]}
        />
        <Link to="/time" className="inline-block text-sm font-medium underline">
          View time
        </Link>
      </section>
      <PayrollSection
        companyId={selected.id}
        isAdmin={isAdmin}
        payroll={counts.payroll}
      />
    </div>
  );
}

function PayrollSection({
  companyId,
  isAdmin,
  payroll,
}: {
  companyId: string;
  isAdmin: boolean;
  payroll: Dashboard['payroll'];
}) {
  const queryClient = useQueryClient();
  const [rate, setRate] = useState(minorToInput(payroll.hourlyRateMinor));
  const [currency, setCurrency] = useState(payroll.currency);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const minor = majorToMinor(rate);
      if (minor === null) {
        throw new CompanyRequestError('Enter an hourly rate with at most two decimal places.');
      }
      return setPayRate(companyId, minor, currency);
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] });
    },
    onError: (error: unknown) => {
      setFormError(messageFrom(error));
    },
  });
  const total =
    payroll.amountMinor === null ? 'Not calculated' : formatMoney(payroll.amountMinor, payroll.currency);
  const rateLabel =
    payroll.hourlyRateMinor === null
      ? 'Not set'
      : `${formatMoney(payroll.hourlyRateMinor, payroll.currency)} per hour`;

  return (
    <section className="max-w-3xl space-y-3 rounded-lg border border-border bg-card px-4 py-4">
      <h2 className="text-sm font-semibold">Payroll</h2>
      <p className="text-sm text-muted-foreground">{payroll.detail}</p>
      <CountList
        rows={[
          { label: 'Accepted minutes', value: payroll.acceptedMinutes },
          { label: 'Hourly rate', value: rateLabel },
          { label: 'Payroll total', value: total },
        ]}
      />
      {isAdmin ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label htmlFor="hourly-rate">Hourly rate</Label>
            <Input
              id="hourly-rate"
              className="mt-2"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pay-currency">Currency</Label>
            <select
              id="pay-currency"
              className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Dashboard['payroll']['currency'])}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          {formError ? <p className="text-sm text-bad">{formError}</p> : null}
          <Button type="submit" disabled={save.isPending}>
            Save rate
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">An admin sets the hourly rate.</p>
      )}
    </section>
  );
}

function CountList({ rows }: { rows: { label: string; value: number | string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{row.label}</dt>
          <dd className="text-lg font-semibold break-words tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function minorToInput(minor: number | null): string {
  if (minor === null) {
    return '';
  }
  return (minor / 100).toFixed(2);
}

function majorToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The dashboard request failed.';
}

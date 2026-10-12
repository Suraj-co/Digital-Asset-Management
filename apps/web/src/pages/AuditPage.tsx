import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { fetchAuditEvents } from '@/api/audit';
import { CompanyRequestError } from '@/api/companies';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { useCompany } from '@/shell/company-context';
import { useSession } from '@/shell/session-context';

const description =
  'Stored sentences for this company. A sign-in, a page view, and a folder path are not listed. Earlier work is not copied here. No file is stored.';

export function AuditPage() {
  const { session, ready } = useSession();
  const company = useCompany();
  const selected = company.selected;
  const audit = useQuery({
    queryKey: ['audit-events', selected?.id],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchAuditEvents(selected!.id),
  });

  if (!ready || (session && !company.ready)) {
    return <LoadingState label="Loading company membership." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader title="Audit" description={description} />
        <EmptyState
          title="Sign in is required"
          description="The audit log is available after a server session."
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
        <PageHeader title="Audit" description={description} />
        <EmptyState
          title="No company membership"
          description="An admin of a company has to grant access before this log can be shown."
        />
      </div>
    );
  }
  if (audit.isLoading) {
    return <LoadingState label="Loading the audit log." />;
  }
  if (audit.error || !audit.data) {
    return (
      <ErrorState
        title="The audit log is unavailable"
        detail={messageFrom(audit.error)}
        onRetry={() => void audit.refetch()}
      />
    );
  }

  const page = audit.data;
  return (
    <div className="min-w-0 max-w-3xl space-y-6">
      <PageHeader title="Audit" description={`${selected.code}. ${description}`} />
      {page.items.length === 0 ? (
        <EmptyState
          title="No audit events"
          description="Nothing has been recorded since this log started. Earlier work is not copied here. No file is stored."
        />
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {page.items.map((item) => (
              <li key={item.id} className="min-w-0 rounded-lg border border-border bg-card px-4 py-3">
                <p className="break-words text-sm">{item.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.actorEmail} · {item.companyCode}
                </p>
              </li>
            ))}
          </ul>
          {page.total > page.items.length ? (
            <p className="text-sm text-muted-foreground">This list is the latest rows.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The audit request failed.';
}

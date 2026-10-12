import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CompanyRequestError } from '@/api/companies';
import { fetchNotifications, markNotificationRead } from '@/api/notifications';
import { NotificationList } from '@/components/shell/NotificationList';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { useSession } from '@/shell/session-context';

export function NotificationsPage() {
  const { session, ready } = useSession();
  const queryClient = useQueryClient();
  const notices = useQuery({
    queryKey: ['notifications'],
    enabled: Boolean(session),
    queryFn: () => fetchNotifications(),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  if (!ready) {
    return <LoadingState label="Loading the session." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Notifications"
          description="A notice is a row in this app. An email copy is queued in Redis and sent only when a mail server is configured."
        />
        <EmptyState
          title="Sign in is required"
          description="Notifications are available after a server session. An email copy is queued after you sign in."
        />
        <Link to="/sign-in" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (notices.isLoading) {
    return <LoadingState label="Loading notifications." />;
  }
  if (notices.error || !notices.data) {
    return (
      <ErrorState
        title="Notifications are unavailable"
        detail={messageFrom(notices.error)}
        onRetry={() => void notices.refetch()}
      />
    );
  }

  return (
    <div className="min-w-0 max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description="These rows are addressed to you. An email copy is queued in Redis and sent only when a mail server is configured."
      />
      <NotificationList
        page={notices.data}
        pendingId={markRead.isPending ? (markRead.variables ?? null) : null}
        onMarkRead={(id) => markRead.mutate(id)}
      />
    </div>
  );
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The notification request failed.';
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router';
import { CompanyRequestError } from '@/api/companies';
import { fetchNotifications, markNotificationRead } from '@/api/notifications';
import { NotificationList } from '@/components/shell/NotificationList';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/shell/session-context';

export function NotificationsMenu() {
  const { session } = useSession();
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
  const unread = notices.data?.unread ?? 0;
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative" aria-label={label}>
          <Bell />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Link to="/notifications" className="text-sm font-medium underline">
            All notifications
          </Link>
        </div>
        {!session ? (
          <EmptyState
            title="Sign in is required"
            description="Notifications are available after a server session. An email copy is queued after you sign in."
          />
        ) : notices.isLoading ? (
          <LoadingState label="Loading notifications." />
        ) : notices.error || !notices.data ? (
          <ErrorState
            title="Notifications are unavailable"
            detail={messageFrom(notices.error)}
            onRetry={() => void notices.refetch()}
          />
        ) : (
          <NotificationList
            page={notices.data}
            pendingId={markRead.isPending ? (markRead.variables ?? null) : null}
            onMarkRead={(id) => markRead.mutate(id)}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The notification request failed.';
}

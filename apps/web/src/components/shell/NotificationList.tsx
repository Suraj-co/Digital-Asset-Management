import { Link } from 'react-router';
import type { NotificationPage } from '@/api/notifications';
import { EmptyState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';

export function NotificationList({
  page,
  pendingId,
  onMarkRead,
}: {
  page: NotificationPage;
  pendingId: string | null;
  onMarkRead: (id: string) => void;
}) {
  if (page.items.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="Nothing is waiting. An email copy is queued when someone else assigns you, returns your time, or rejects your asset."
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {page.items.map((item) => (
          <li key={item.id} className="min-w-0 rounded-lg border border-border bg-card px-3 py-3">
            <Link to={item.href} className="block break-words text-sm font-medium underline">
              {item.body}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">{item.companyCode}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.email?.detail ?? 'This notice has no email copy.'}
            </p>
            <div className="mt-2">
              {item.readAt ? (
                <span className="text-sm text-muted-foreground">Read</span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pendingId === item.id}
                  onClick={() => onMarkRead(item.id)}
                >
                  Mark read
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {page.total > page.items.length ? (
        <p className="text-sm text-muted-foreground">This list is the latest rows.</p>
      ) : null}
    </div>
  );
}

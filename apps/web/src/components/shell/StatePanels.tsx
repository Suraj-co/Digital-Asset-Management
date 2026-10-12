import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-16 w-full" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-bad/30 bg-bad-bg px-4 py-4" role="alert">
      <h2 className="text-sm font-semibold text-bad">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-bad">{detail}</p>
      {onRetry ? (
        <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function IncompleteNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-warn/30 bg-warn-bg px-3 py-2 text-sm leading-6 text-warn">
      {children}
    </p>
  );
}

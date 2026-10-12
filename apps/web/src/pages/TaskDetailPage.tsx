import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CompanyRequestError } from '@/api/companies';
import { commentOnTask, fetchTask, transitionTask, type Task } from '@/api/tasks';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STAGE_LABEL: Record<Task['stage'], string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted_rm_qc: 'Submitted for RM QC',
  rm_approved: 'RM approved',
  submitted_admin_qc: 'Submitted for Admin QC',
  admin_approved: 'Admin approved',
  ready_to_publish: 'Ready to publish',
  completed: 'Completed',
  changes_requested: 'Changes requested',
};

const ACTION_LABEL: Record<Task['actions'][number], string> = {
  start: 'Start',
  submit: 'Submit for RM QC',
  approve: 'Approve',
  reject: 'Request changes',
  complete: 'Complete',
  resubmit: 'Resubmit',
};

export function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const task = useQuery({
    queryKey: ['task', taskId],
    enabled: taskId.length > 0,
    queryFn: () => fetchTask(taskId),
  });

  if (task.isLoading) {
    return <LoadingState label="Loading task." />;
  }
  if (task.error || !task.data) {
    return (
      <ErrorState
        title="This task is unavailable"
        detail={messageFrom(task.error)}
        onRetry={() => void task.refetch()}
      />
    );
  }

  const item = task.data;
  return (
    <div className="space-y-8">
      <PageHeader
        title={item.title}
        description={`${item.companyCode} · ${STAGE_LABEL[item.stage]} · ${item.assigneeEmail ?? 'Unassigned'}`}
      />
      <p className="text-sm text-muted-foreground">
        <Link to="/tasks" className="underline">
          Tasks
        </Link>
        {' · '}
        <Link to="/time" className="underline">
          Timesheets
        </Link>
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>Deadline: {item.deadline ?? 'Not set'}</div>
        <div>Priority: {item.priority ?? 'Not set'}</div>
        <div>Department: {item.departmentName ?? 'Not set'}</div>
        <div>Asset: {item.assetCode ?? 'None'}</div>
        <div>Created by: {item.createdByEmail}</div>
        <div>Detail: {item.detail || 'None'}</div>
      </dl>
      <TaskActions taskId={item.id} actions={item.actions} />
      <CommentForm taskId={item.id} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Comments</h2>
        {item.comments.length === 0 ? (
          <EmptyState title="No comments" description="Review comments stay on this task." />
        ) : (
          <ul className="space-y-2">
            {item.comments.map((comment) => (
              <li key={comment.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p>{comment.body}</p>
                <p className="text-muted-foreground">
                  {comment.authorEmail} · {comment.createdAt.slice(0, 16).replace('T', ' ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <FileForm taskId={item.id} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Attachments</h2>
        {item.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files are attached.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {item.files.map((file) => (
              <li key={file.id}>
                {file.fileName} · {file.detail}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">History</h2>
        <ul className="space-y-1 text-sm">
          {item.history.map((event) => (
            <li key={`${event.createdAt}-${event.summary}`}>
              {event.createdAt.slice(0, 16).replace('T', ' ')} · {event.summary}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TaskActions({
  taskId,
  actions,
}: {
  taskId: string;
  actions: Task['actions'];
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (action: Task['actions'][number]) =>
      transitionTask(taskId, action, action === 'reject' ? reason : undefined),
  });
  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground">No actions are available for your role.</p>;
  }
  return (
    <div className="space-y-2">
      {actions.includes('reject') ? (
        <div>
          <Label htmlFor="task-reason">Comment for a rejection</Label>
          <Textarea
            id="task-reason"
            className="mt-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === 'reject' ? 'outline' : 'default'}
            disabled={mutation.isPending}
            onClick={() => {
              setError(null);
              void mutation.mutateAsync(action).then(
                async () => {
                  setReason('');
                  await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
                  await queryClient.invalidateQueries({ queryKey: ['tasks'] });
                },
                (caught: unknown) => setError(messageFrom(caught)),
              );
            }}
          >
            {ACTION_LABEL[action]}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-bad">{error}</p> : null}
    </div>
  );
}

function CommentForm({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: () => commentOnTask(taskId, body) });
  return (
    <form
      className="max-w-xl space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        void mutation.mutateAsync().then(
          async () => {
            setBody('');
            await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
          },
          (caught: unknown) => setError(messageFrom(caught)),
        );
      }}
    >
      <Label htmlFor="task-comment">Comment</Label>
      <Textarea id="task-comment" value={body} onChange={(event) => setBody(event.target.value)} />
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      <Button type="submit" disabled={mutation.isPending || body.trim().length === 0}>
        Add comment
      </Button>
    </form>
  );
}

function FileForm({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.set('file', file);
      return fetch(`/api/v1/tasks/${taskId}/files`, {
        method: 'POST',
        credentials: 'include',
        body,
      }).then(async (response) => {
        if (!response.ok) {
          throw new CompanyRequestError(await readMessage(response));
        }
        return response.json();
      });
    },
  });
  return (
    <form className="space-y-2">
      <Label htmlFor="task-file">Attachment</Label>
      <input
        id="task-file"
        className="block text-sm"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          setError(null);
          void mutation.mutateAsync(file).then(
            async () => {
              await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
            },
            (caught: unknown) => setError(messageFrom(caught)),
          );
        }}
      />
      {error ? <p className="text-sm text-bad">{error}</p> : null}
    </form>
  );
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The task request failed.';
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The task request failed.';
}

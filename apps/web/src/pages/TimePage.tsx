import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { CompanyRequestError } from '@/api/companies';
import { fetchTasks } from '@/api/tasks';
import {
  createTimeEntry,
  fetchTimeEntries,
  reviewTimeEntry,
  updateTimeEntry,
  type TimeEntry,
} from '@/api/time';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompany } from '@/shell/company-context';
import { useSession } from '@/shell/session-context';

const timeFormSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a work date as YYYY-MM-DD.'),
  minutes: z.coerce
    .number()
    .int('Enter a whole number of minutes.')
    .min(1, 'Enter 1 to 720 minutes.')
    .max(720, 'Enter 1 to 720 minutes.'),
  note: z.string().trim().max(500, 'Use 500 characters or fewer.'),
  taskId: z.string(),
});

type TimeFormInput = z.input<typeof timeFormSchema>;
type TimeFormValues = z.output<typeof timeFormSchema>;

const selectClass =
  'mt-2 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm';

const STATUS_LABEL: Record<TimeEntry['status'], string> = {
  open: 'Open',
  submitted: 'Submitted',
  accepted: 'Accepted',
  returned: 'Returned',
};

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TimePage() {
  const { session, ready } = useSession();
  const company = useCompany();
  const selected = company.selected;
  const entries = useQuery({
    queryKey: ['time-entries', selected?.id],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchTimeEntries(selected!.id),
  });

  if (!ready || (session && !company.ready)) {
    return <LoadingState label="Loading company membership." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Time"
          description="Minutes are the number you enter. The payroll total is on the dashboard."
        />
        <EmptyState
          title="Sign in is required"
          description="Time entries are available after a server session."
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
        <PageHeader
          title="Time"
          description="Minutes are the number you enter. The payroll total is on the dashboard."
        />
        <EmptyState
          title="No company membership"
          description="An admin of a company has to grant access before time can be recorded."
        />
      </div>
    );
  }
  if (entries.isLoading) {
    return <LoadingState label="Loading time entries." />;
  }
  if (entries.error) {
    return (
      <ErrorState
        title="Time entries are unavailable"
        detail={messageFrom(entries.error)}
        onRetry={() => void entries.refetch()}
      />
    );
  }

  const seesCompany = selected.roles.includes('rm') || selected.roles.includes('admin');
  const items = entries.data?.items ?? [];
  const total = entries.data?.total ?? items.length;

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title="Time"
        description={`${selected.code}. Minutes are the number you enter. The payroll total is on the dashboard. A return is shown in the app, and an email copy is queued. ${
          seesCompany ? 'You see every entry in this company.' : 'You see your own entries.'
        }`}
      />
      <TimeForm companyId={selected.id} />
      <TimeTable items={items} total={total} companyId={selected.id} />
    </div>
  );
}

function TimeForm({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const tasks = useQuery({
    queryKey: ['tasks', companyId],
    queryFn: () => fetchTasks(companyId),
  });
  const form = useForm<TimeFormInput, unknown, TimeFormValues>({
    resolver: zodResolver(timeFormSchema),
    defaultValues: { workDate: utcToday(), minutes: 60, note: '', taskId: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: TimeFormValues) =>
      createTimeEntry({
        companyId,
        workDate: values.workDate,
        minutes: values.minutes,
        note: values.note.length > 0 ? values.note : undefined,
        taskId: values.taskId.length > 0 ? values.taskId : undefined,
      }),
  });

  return (
    <form
      className="max-w-xl space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          setFormError(null);
          setNotice(null);
          try {
            const entry = await mutation.mutateAsync(values);
            setNotice(`${entry.minutes} minutes recorded. The payroll total is on the dashboard.`);
            form.reset({ workDate: utcToday(), minutes: 60, note: '', taskId: '' });
            await queryClient.invalidateQueries({ queryKey: ['time-entries', companyId] });
          } catch (error) {
            setFormError(messageFrom(error));
          }
        })(event)
      }
      noValidate
    >
      <h2 className="text-sm font-semibold">Record time</h2>
      <p className="text-sm text-muted-foreground">
        The work date uses UTC and cannot be in the future. An optional task must belong to this
        company.
      </p>
      <div>
        <Label htmlFor="time-date">Work date</Label>
        <Input id="time-date" className="mt-2" type="date" {...form.register('workDate')} />
        {form.formState.errors.workDate ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.workDate.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="time-minutes">Minutes</Label>
        <Input
          id="time-minutes"
          className="mt-2"
          type="number"
          min={1}
          max={720}
          {...form.register('minutes')}
        />
        {form.formState.errors.minutes ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.minutes.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="time-note">Note</Label>
        <Input id="time-note" className="mt-2" {...form.register('note')} />
        {form.formState.errors.note ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.note.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="time-task">Task</Label>
        <select id="time-task" className={selectClass} {...form.register('taskId')}>
          <option value="">No task</option>
          {(tasks.data?.items ?? []).map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        {tasks.error ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks could not be loaded. You can still record time without one.
          </p>
        ) : null}
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        Record time
      </Button>
    </form>
  );
}

function TimeTable({
  items,
  total,
  companyId,
}: {
  items: TimeEntry[];
  total: number;
  companyId: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No time entries"
        description="Minutes you record for this company appear here. The payroll total is on the dashboard."
      />
    );
  }
  const shown = items.reduce((sum, item) => sum + item.minutes, 0);
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-sm text-muted-foreground">
        Sum of these rows: {shown} minutes. The payroll total is on the dashboard.
        {total > items.length ? ' The sum is only these rows.' : null}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Minutes</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Person</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.workDate}</TableCell>
              <TableCell>{item.minutes}</TableCell>
              <TableCell className="whitespace-normal">{item.taskTitle ?? 'None'}</TableCell>
              <TableCell className="break-all whitespace-normal">{item.userEmail}</TableCell>
              <TableCell className="whitespace-normal">
                <div>{STATUS_LABEL[item.status]}</div>
                {item.reviewReason ? (
                  <p className="mt-1 text-muted-foreground">{item.reviewReason}</p>
                ) : null}
              </TableCell>
              <TableCell>
                <EntryActions entry={item} companyId={companyId} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EntryActions({ entry, companyId }: { entry: TimeEntry; companyId: string }) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(String(entry.minutes));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['time-entries', companyId] });
  const save = useMutation({
    mutationFn: () => updateTimeEntry(entry.id, { minutes: Number(minutes) }),
  });
  const review = useMutation({
    mutationFn: (input: { action: 'submit' | 'accept' | 'return'; reason?: string }) =>
      reviewTimeEntry(entry.id, input),
  });

  async function run(work: () => Promise<unknown>) {
    setError(null);
    try {
      await work();
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  if (entry.actions.includes('submit')) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={`correct-${entry.id}`}>Minutes</Label>
        <Input
          id={`correct-${entry.id}`}
          type="number"
          min={1}
          max={720}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={save.isPending}
          onClick={() => void run(() => save.mutateAsync())}
        >
          Save minutes
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={review.isPending}
          onClick={() => void run(() => review.mutateAsync({ action: 'submit' }))}
        >
          Submit
        </Button>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
      </div>
    );
  }

  if (entry.actions.includes('accept') && entry.actions.includes('return')) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <Button
          type="button"
          size="sm"
          disabled={review.isPending}
          onClick={() => void run(() => review.mutateAsync({ action: 'accept' }))}
        >
          Accept
        </Button>
        <Label htmlFor={`reason-${entry.id}`}>Reason</Label>
        <Input
          id={`reason-${entry.id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={review.isPending}
          onClick={() => void run(() => review.mutateAsync({ action: 'return', reason }))}
        >
          Return
        </Button>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
      </div>
    );
  }

  return <span className="text-sm text-muted-foreground">None</span>;
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The time request failed.';
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { fetchAssets } from '@/api/assets';
import { CompanyRequestError } from '@/api/companies';
import { fetchDepartments } from '@/api/folders';
import { createTask, fetchTasks, type Task } from '@/api/tasks';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or fewer.'),
  detail: z.string().trim().max(500, 'Use 500 characters or fewer.'),
  assetId: z.string(),
  assigneeEmail: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || z.email().safeParse(value).success,
      'Enter a valid email address.',
    ),
  deadline: z.string(),
  priority: z.enum(['', 'low', 'normal', 'high']),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const selectClass =
  'mt-2 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm';

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

type Workspace = 'tasks' | 'planner' | 'rm' | 'admin' | 'analytics';

export function TasksPage() {
  const { session, ready } = useSession();
  const company = useCompany();
  const selected = company.selected;
  const [departmentId, setDepartmentId] = useState('');
  const [workspace, setWorkspace] = useState<Workspace>('tasks');
  const tasks = useQuery({
    queryKey: ['tasks', selected?.id, departmentId],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchTasks(selected!.id, departmentId || undefined),
  });
  const departments = useQuery({
    queryKey: ['departments', selected?.id],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchDepartments(selected!.id),
  });

  if (!ready || (session && !company.ready)) {
    return <LoadingState label="Loading company membership." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Tasks"
          description="A task is a plan for one company. It does not record time or store a file."
        />
        <EmptyState
          title="Sign in is required"
          description="Tasks are available after a server session."
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
          title="Tasks"
          description="A task is a plan for one company. It does not record time or store a file."
        />
        <EmptyState
          title="No company membership"
          description="An admin of a company has to grant access before tasks can be planned."
        />
      </div>
    );
  }
  if (tasks.isLoading) {
    return <LoadingState label="Loading tasks." />;
  }
  if (tasks.error) {
    return (
      <ErrorState
        title="Tasks are unavailable"
        detail={messageFrom(tasks.error)}
        onRetry={() => void tasks.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tasks"
        description={`${selected.code}. A task is a plan. It does not record time or store a file. The assignee is told in the app, and an email copy is queued.`}
      />
      <TaskForm companyId={selected.id} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="task-department">Department</Label>
          <select
            id="task-department"
            className={selectClass}
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">All departments</option>
            {(departments.data?.items ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['tasks', 'Tasks'],
              ['planner', 'Planner'],
              ['rm', 'RM QC'],
              ['admin', 'Admin QC'],
              ['analytics', 'Analytics'],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              variant={workspace === id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setWorkspace(id)}
            >
              {label}
            </Button>
          ))}
          <Link to="/time" className="self-center text-sm font-medium underline">
            Timesheets
          </Link>
        </div>
      </div>
      <TaskWorkspace
        workspace={workspace}
        items={tasks.data?.items ?? []}
        stages={tasks.data?.stages}
      />
    </div>
  );
}

function TaskForm({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const assets = useQuery({
    queryKey: ['assets', companyId, ''],
    queryFn: () => fetchAssets(companyId),
  });
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: '', detail: '', assetId: '', assigneeEmail: '', deadline: '', priority: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: TaskFormValues) =>
      createTask({
        companyId,
        title: values.title,
        detail: values.detail.length > 0 ? values.detail : undefined,
        assetId: values.assetId.length > 0 ? values.assetId : undefined,
        assigneeEmail: values.assigneeEmail.length > 0 ? values.assigneeEmail : undefined,
        deadline: values.deadline.length > 0 ? values.deadline : undefined,
        priority: values.priority === '' ? undefined : values.priority,
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
            const task = await mutation.mutateAsync(values);
            setNotice(`${task.title} added. Time was not recorded.`);
            form.reset({ title: '', detail: '', assetId: '', assigneeEmail: '', deadline: '', priority: '' });
            await queryClient.invalidateQueries({ queryKey: ['tasks', companyId] });
          } catch (error) {
            setFormError(messageFrom(error));
          }
        })(event)
      }
      noValidate
    >
      <h2 className="text-sm font-semibold">Add a task</h2>
      <p className="text-sm text-muted-foreground">
        The assignee must already belong to this company. The assignee is told in the app, and an email copy is queued.
      </p>
      <div>
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" className="mt-2" {...form.register('title')} />
        {form.formState.errors.title ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.title.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="task-detail">Detail</Label>
        <Textarea id="task-detail" className="mt-2" {...form.register('detail')} />
        {form.formState.errors.detail ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.detail.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="task-asset">Asset</Label>
        <select id="task-asset" className={selectClass} {...form.register('assetId')}>
          <option value="">No asset</option>
          {(assets.data?.items ?? []).map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.code} · {asset.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="task-deadline">Deadline</Label>
        <Input id="task-deadline" className="mt-2" type="date" {...form.register('deadline')} />
      </div>
      <div>
        <Label htmlFor="task-priority">Priority</Label>
        <select id="task-priority" className={selectClass} {...form.register('priority')}>
          <option value="">No priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <Label htmlFor="task-assignee">Email</Label>
        <Input id="task-assignee" className="mt-2" type="email" {...form.register('assigneeEmail')} />
        {form.formState.errors.assigneeEmail ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.assigneeEmail.message}</p>
        ) : null}
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        Add task
      </Button>
    </form>
  );
}

function TaskWorkspace({
  workspace,
  items,
  stages,
}: {
  workspace: Workspace;
  items: Task[];
  stages: Record<string, number> | undefined;
}) {
  const visible = items.filter((item) => inWorkspace(workspace, item));
  if (workspace === 'analytics') {
    const counts = stages ?? countStages(items);
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {Object.entries(STAGE_LABEL).map(([stage, label]) => (
          <li key={stage} className="rounded-lg border border-border px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="ml-2 font-semibold">{counts[stage] ?? 0}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (workspace === 'planner') {
    const groups = new Map<string, Task[]>();
    for (const item of visible) {
      const key = item.deadline ?? 'No deadline';
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    if (groups.size === 0) {
      return <EmptyState title="No dated tasks" description="Tasks with a deadline appear on the planner." />;
    }
    return (
      <div className="space-y-4">
        {[...groups.entries()].map(([day, rows]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-sm font-semibold">{day}</h2>
            <TaskTable items={rows} />
          </section>
        ))}
      </div>
    );
  }
  return <TaskTable items={visible} />;
}

function inWorkspace(workspace: Workspace, item: Task): boolean {
  if (workspace === 'rm') {
    return item.stage === 'submitted_rm_qc' || item.stage === 'rm_approved';
  }
  if (workspace === 'admin') {
    return (
      item.stage === 'submitted_admin_qc' ||
      item.stage === 'admin_approved' ||
      item.stage === 'ready_to_publish'
    );
  }
  return true;
}

function countStages(items: Task[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.stage] = (counts[item.stage] ?? 0) + 1;
  }
  return counts;
}

function TaskTable({ items }: { items: Task[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No tasks"
        description="Planned work for this company appears here. None of it records time."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Asset</TableHead>
          <TableHead>Assignee</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="whitespace-normal">
              <Link to={`/tasks/${item.id}`} className="font-medium underline">
                {item.title}
              </Link>
            </TableCell>
            <TableCell>{STAGE_LABEL[item.stage]}</TableCell>
            <TableCell>{item.deadline ?? 'Not set'}</TableCell>
            <TableCell>{priorityLabel(item.priority)}</TableCell>
            <TableCell>{item.departmentName ?? 'Not set'}</TableCell>
            <TableCell>{item.assetCode ?? 'None'}</TableCell>
            <TableCell className="whitespace-normal">{item.assigneeEmail ?? 'Unassigned'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function priorityLabel(priority: Task['priority']): string {
  if (priority === 'low') return 'Low';
  if (priority === 'normal') return 'Normal';
  if (priority === 'high') return 'High';
  return 'Not set';
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The task request failed.';
}

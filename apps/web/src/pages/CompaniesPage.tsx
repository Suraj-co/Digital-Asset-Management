import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import {
  CompanyRequestError,
  fetchUsers,
  fetchCreatorInvitations,
  grantMembership,
  invitationNotice,
  inviteCreator,
  resendCreatorInvitation,
  revokeMembership,
  roleLabel,
  updateUserStatus,
  type Company,
} from '@/api/companies';
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
import { COMPANY_CODES } from '@/shell/navigation';
import { useSession } from '@/shell/session-context';

const registry = `${COMPANY_CODES.slice(0, -1).join(', ')}, and ${COMPANY_CODES[COMPANY_CODES.length - 1]}`;

const grantSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email.'),
  role: z.enum(['creator', 'rm', 'admin']),
});

const inviteSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name.').max(80, 'Use 80 characters or fewer.'),
    email: z.string().trim().min(1, 'Enter an email.'),
    password: z
      .string()
      .min(12, 'Use 12 to 200 characters.')
      .max(200, 'Use 12 to 200 characters.')
      .refine((value) => !/[\u0000-\u001f]/.test(value), 'Use a password without control characters.'),
  })
  .refine((values) => values.password.toLowerCase() !== values.email.trim().toLowerCase(), {
    message: 'Use a password that is not the email.',
    path: ['password'],
  });

type InviteValues = z.infer<typeof inviteSchema>;

type GrantValues = z.infer<typeof grantSchema>;

export function CompaniesPage() {
  const { session, ready } = useSession();
  const company = useCompany();
  const queryClient = useQueryClient();
  const isAdmin = company.companies.some((item) => item.roles.includes('admin'));
  const [offset, setOffset] = useState(0);
  const users = useQuery({
    queryKey: ['users', session?.user.id, offset],
    enabled: Boolean(session) && company.ready && isAdmin,
    queryFn: () => fetchUsers(offset),
  });

  async function refresh() {
    await company.reload();
    await queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  if (!ready || (session && !company.ready)) {
    return <LoadingState label="Loading company membership." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Companies"
          description={`${registry} are in the registry. Membership decides which company a person can open.`}
        />
        <EmptyState
          title="Sign in is required"
          description="Company membership is available after a server session."
        />
        <Link to="/sign-in" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (company.error) {
    return (
      <ErrorState
        title="Companies are unavailable"
        detail={company.error}
        onRetry={() => void company.reload()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Companies"
        description={`${registry} are in the registry. This page lists only your memberships. Choosing one in the header does not grant access.`}
      />
      {company.companies.length === 0 ? (
        <EmptyState
          title="No company membership"
          description="An admin of a company, or an operator using the grant script, assigns access. ASEDS is not a company."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {company.companies.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <span className="font-medium">{item.code}</span>
              <span className="text-sm text-muted-foreground">
                {item.roles.map(roleLabel).join(', ')}
              </span>
              {company.selected?.id === item.id ? (
                <span className="text-sm text-muted-foreground">Selected in this tab</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {company.companies
        .filter((item) => item.roles.includes('admin') || item.roles.includes('rm'))
        .map((item) => (
          <InviteForm key={`invite-${item.id}`} company={item} />
        ))}
      {isAdmin
        ? company.companies
            .filter((item) => item.roles.includes('admin'))
            .map((item) => (
              <GrantForm key={item.id} company={item} onGranted={() => void refresh()} />
            ))
        : null}
      {isAdmin ? (
        <UsersTable
          loading={users.isLoading}
          error={
            users.error instanceof CompanyRequestError
              ? users.error.message
              : users.error
                ? 'The user request failed.'
                : null
          }
          items={users.data?.items ?? []}
          total={users.data?.total ?? 0}
          offset={offset}
          selfId={session.user.id}
          onOffset={setOffset}
          onRetry={() => void users.refetch()}
          onChanged={() => void refresh()}
        />
      ) : null}
    </div>
  );
}

function InviteForm({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const invitations = useQuery({
    queryKey: ['creator-invitations', company.id],
    queryFn: () => fetchCreatorInvitations(company.id),
  });
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: InviteValues) =>
      inviteCreator(company.id, values.name, values.email, values.password),
  });

  async function reloadInvitations() {
    await queryClient.invalidateQueries({ queryKey: ['creator-invitations', company.id] });
  }

  return (
    <form
      className="max-w-md space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          setFormError(null);
          setNotice(null);
          try {
            const invitation = await mutation.mutateAsync(values);
            form.reset({ name: '', email: '', password: '' });
            setShowPassword(false);
            setNotice(invitationNotice(invitation.email, invitation.delivery));
            await reloadInvitations();
          } catch (error) {
            setFormError(
              error instanceof CompanyRequestError
                ? error.message
                : 'The company request failed.',
            );
          }
        })(event)
      }
      noValidate
    >
      <h2 className="text-sm font-semibold">Invite a creator in {company.code}</h2>
      <p className="text-sm text-muted-foreground">
        An RM or an admin sets the initial password. The email contains the login address and a setup link. It does not contain the password.
      </p>
      <div>
        <Label htmlFor={`invite-name-${company.id}`}>Name</Label>
        <Input id={`invite-name-${company.id}`} className="mt-2" autoComplete="off" {...form.register('name')} />
        {form.formState.errors.name ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor={`invite-email-${company.id}`}>Creator email</Label>
        <Input
          id={`invite-email-${company.id}`}
          className="mt-2"
          type="email"
          autoComplete="off"
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor={`invite-password-${company.id}`}>Password</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id={`invite-password-${company.id}`}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            {...form.register('password')}
          />
          <Button
            type="button"
            variant="outline"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </Button>
        </div>
        {form.formState.errors.password ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? (
        <p className={notice.tone === 'bad' ? 'text-sm text-bad' : 'text-sm'}>{notice.text}</p>
      ) : null}
      <Button type="submit" disabled={mutation.isPending}>
        Send invitation
      </Button>
      {invitations.error ? (
        <p className="text-sm text-bad">
          {invitations.error instanceof CompanyRequestError
            ? invitations.error.message
            : 'Open invitations could not be loaded.'}
        </p>
      ) : null}
      {invitations.data && invitations.data.items.length > 0 ? (
        <ul className="space-y-3 border-t border-border pt-3">
          {invitations.data.items.map((item) => {
            const itemNotice = invitationNotice(item.email, item.delivery);
            return (
              <li key={item.id} className="space-y-1">
                <p className="text-sm font-medium">
                  {item.name} · {item.email}
                </p>
                <p className={itemNotice.tone === 'bad' ? 'text-sm text-bad' : 'text-sm text-muted-foreground'}>
                  {item.delivery.status}: {item.delivery.detail}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={resendingId === item.id}
                  onClick={() => {
                    setResendingId(item.id);
                    setFormError(null);
                    void resendCreatorInvitation(company.id, item.id)
                      .then(async (invitation) => {
                        setNotice(invitationNotice(invitation.email, invitation.delivery));
                        await reloadInvitations();
                      })
                      .catch((error: unknown) => {
                        setFormError(
                          error instanceof CompanyRequestError
                            ? error.message
                            : 'The company request failed.',
                        );
                      })
                      .finally(() => setResendingId(null));
                  }}
                >
                  Resend invitation
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </form>
  );
}

function GrantForm({
  company,
  onGranted,
}: {
  company: Company;
  onGranted: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<GrantValues>({
    resolver: zodResolver(grantSchema),
    defaultValues: { email: '', role: 'creator' },
  });
  const mutation = useMutation({
    mutationFn: (values: GrantValues) =>
      grantMembership(company.id, values.email, values.role),
  });

  async function onSubmit(values: GrantValues) {
    setFormError(null);
    setNotice(null);
    try {
      const membership = await mutation.mutateAsync(values);
      form.reset({ email: '', role: values.role });
      setNotice(`${membership.companyCode} membership granted.`);
      onGranted();
    } catch (error) {
      setFormError(
        error instanceof CompanyRequestError
          ? error.message
          : 'The company request failed.',
      );
    }
  }

  return (
    <form
      className="max-w-md space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      noValidate
    >
      <h2 className="text-sm font-semibold">Grant access in {company.code}</h2>
      <div>
        <Label htmlFor={`grant-email-${company.id}`}>Email</Label>
        <Input
          id={`grant-email-${company.id}`}
          className="mt-2"
          type="email"
          autoComplete="off"
          aria-invalid={form.formState.errors.email ? true : undefined}
          aria-describedby={
            form.formState.errors.email ? `grant-email-${company.id}-error` : undefined
          }
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <p id={`grant-email-${company.id}-error`} className="mt-1 text-sm text-bad">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor={`grant-role-${company.id}`}>Role</Label>
        <select
          id={`grant-role-${company.id}`}
          className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
          {...form.register('role')}
        >
          <option value="creator">Creator</option>
          <option value="rm">RM</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        Grant membership
      </Button>
    </form>
  );
}

function UsersTable({
  loading,
  error,
  items,
  total,
  offset,
  selfId,
  onOffset,
  onRetry,
  onChanged,
}: {
  loading: boolean;
  error: string | null;
  items: Awaited<ReturnType<typeof fetchUsers>>['items'];
  total: number;
  offset: number;
  selfId: string;
  onOffset: (offset: number) => void;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
      onChanged();
    } catch (caught) {
      setActionError(
        caught instanceof CompanyRequestError
          ? caught.message
          : 'The user request failed.',
      );
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  }

  if (loading) {
    return <LoadingState label="Loading people in your companies." />;
  }
  if (error) {
    return <ErrorState title="People are unavailable" detail={error} onRetry={onRetry} />;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">People you can manage</h2>
      {items.length === 0 ? (
        <EmptyState
          title="No people in these companies"
          description="Grant a membership to add someone who already has an account."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.status === 'active' ? 'Active' : 'Disabled'}</TableCell>
                <TableCell>
                  {user.memberships
                    .map((membership) => `${membership.companyCode} ${roleLabel(membership.role)}`)
                    .join(', ')}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {user.id === selfId ? (
                      <span className="text-sm text-muted-foreground">Your account</span>
                    ) : confirmId === user.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingId === user.id}
                        onClick={() => {
                          setPendingId(user.id);
                          void run(() =>
                            updateUserStatus(
                              user.id,
                              user.status === 'active' ? 'disabled' : 'active',
                            ).then(() => undefined),
                          );
                        }}
                      >
                        {user.status === 'active' ? 'Confirm disable' : 'Confirm enable'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmId(user.id)}
                      >
                        {user.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                    {user.memberships.map((membership) => (
                      <Button
                        key={membership.id}
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === membership.id}
                        onClick={() => {
                          setPendingId(membership.id);
                          void run(() =>
                            revokeMembership(membership.companyId, membership.id),
                          );
                        }}
                      >
                        Remove {membership.companyCode}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {actionError ? <p className="text-sm text-bad">{actionError}</p> : null}
      <p className="text-sm text-muted-foreground">
        Showing {items.length} of {total}.
      </p>
      {total > 20 ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => onOffset(Math.max(0, offset - 20))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + 20 >= total}
            onClick={() => onOffset(offset + 20)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}

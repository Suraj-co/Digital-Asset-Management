import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import { acceptInvitation, CompanyRequestError, type AcceptedInvitation } from '@/api/companies';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const setupSchema = z
  .object({
    password: z.string().min(12, 'Use 12 to 200 characters.').max(200, 'Use 12 to 200 characters.'),
    confirm: z.string().min(1, 'Repeat the password.'),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'The passwords do not match.',
    path: ['confirm'],
  });

type SetupValues = z.infer<typeof setupSchema>;

export function AcceptInvitationPage() {
  const { token } = useParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<AcceptedInvitation | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { password: '', confirm: '' },
  });

  if (!token) {
    return (
      <PageHeader
        title="Invitation"
        description="This invitation link is not valid."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Set your password"
        description="The invitation email does not contain a password. Sign in with the password your inviter set, or replace it here."
      />
      {done ? (
        <div className="max-w-md space-y-3 rounded-lg border border-border bg-card px-4 py-4">
          <p className="text-sm">
            {done.passwordSet
              ? `Password saved for ${done.email}.`
              : `${done.email} already has a password.`}
          </p>
          <p className="text-sm text-muted-foreground">
            Sign in with that email to open {done.companyCode}.
          </p>
          <Link to="/sign-in" className="text-sm font-medium underline">
            Sign in
          </Link>
        </div>
      ) : (
        <form
          className="max-w-md space-y-3"
          onSubmit={(event) =>
            void form.handleSubmit(async (values) => {
              setFormError(null);
              setPending(true);
              try {
                setDone(await acceptInvitation(token, values.password));
              } catch (error) {
                setFormError(
                  error instanceof CompanyRequestError
                    ? error.message
                    : 'The invitation request failed.',
                );
              } finally {
                setPending(false);
              }
            })(event)
          }
          noValidate
        >
          <div>
            <Label htmlFor="invite-password">Password</Label>
            <Input id="invite-password" className="mt-2" type="password" autoComplete="new-password" {...form.register('password')} />
            {form.formState.errors.password ? (
              <p className="mt-1 text-sm text-bad">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="invite-confirm">Repeat password</Label>
            <Input id="invite-confirm" className="mt-2" type="password" autoComplete="new-password" {...form.register('confirm')} />
            {form.formState.errors.confirm ? (
              <p className="mt-1 text-sm text-bad">{form.formState.errors.confirm.message}</p>
            ) : null}
          </div>
          {formError ? <p className="text-sm text-bad">{formError}</p> : null}
          <Button type="submit" disabled={pending}>
            Save password
          </Button>
        </form>
      )}
    </div>
  );
}

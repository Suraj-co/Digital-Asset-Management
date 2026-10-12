import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SessionRequestError } from '@/api/session';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/shell/session-context';

const signInSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email.'),
  password: z.string().min(1, 'Enter the password.'),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInPage() {
  const { session, ready, signIn, signOut } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    setPending(true);
    try {
      await signIn(values.email, values.password);
      form.reset();
    } catch (error) {
      setFormError(
        error instanceof SessionRequestError
          ? error.message
          : 'The session request failed.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sign in"
        description="Opens a server session in an httpOnly cookie. There is no public registration. This page does not grant company access."
      />
      {session ? (
        <div className="max-w-md rounded-lg border border-border bg-card px-4 py-4">
          <p className="text-sm">
            Signed in as <span className="font-medium">{session.user.email}</span>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The session expires at {session.expiresAt}. Company membership is listed in the
            company menu and on the Companies page.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <form
          className="max-w-md space-y-3"
          onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
          noValidate
        >
          <div>
            <Label htmlFor="sign-in-email">Email</Label>
            <Input
              id="sign-in-email"
              className="mt-2"
              type="email"
              autoComplete="username"
              aria-invalid={form.formState.errors.email ? true : undefined}
              aria-describedby={
                form.formState.errors.email ? 'sign-in-email-error' : undefined
              }
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p id="sign-in-email-error" className="mt-1 text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="sign-in-password">Password</Label>
            <Input
              id="sign-in-password"
              className="mt-2"
              type="password"
              autoComplete="current-password"
              aria-invalid={form.formState.errors.password ? true : undefined}
              aria-describedby={
                form.formState.errors.password ? 'sign-in-password-error' : undefined
              }
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p id="sign-in-password-error" className="mt-1 text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || !ready}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          {!ready ? <p className="text-sm text-muted-foreground">Checking the session.</p> : null}
        </form>
      )}
    </div>
  );
}

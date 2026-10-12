import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createSession,
  deleteSession,
  fetchSession,
  type Session,
} from '@/api/session';
import { SessionContext } from '@/shell/session-context';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchSession()
      .then((next) => {
        if (active) {
          setSession(next);
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await createSession(email, password);
    setSession(next);
    setReady(true);
  }, []);

  const signOut = useCallback(async () => {
    await deleteSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, ready, signIn, signOut }),
    [session, ready, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

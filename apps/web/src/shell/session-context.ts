import { createContext, useContext } from 'react';
import type { Session } from '@/api/session';

export type SessionState = {
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return value;
}

import { createContext, useContext } from 'react';
export interface SessionUser {
  id: string;
  subject: string;
  level: 10 | 20 | 30;
  name?: string;
  email?: string;
  permissions: string[];
  visibility?: {
    mode: 'ASSIGNED' | 'ALL' | 'SELECTED';
    universityIds: string[];
    projectIds: string[];
  };
}
export interface Session {
  user?: SessionUser;
  authenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}
export const SessionContext = createContext<Session | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider is required');
  return session;
}

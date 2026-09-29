import { api } from '../../shared/api';
import type { SessionUser } from '../../shared/session';
export type User = SessionUser;
export interface PublicConfig {
  keycloak: { url: string; realm: string; clientId: string };
}
export const sessionApi = {
  config: () => api<PublicConfig>('/api/config', { cache: 'no-store' }, false),
  me: (signal?: AbortSignal) => api<User>('/api/me', { signal }),
};

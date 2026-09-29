import { api } from '../../shared/api';
import { jsonBody } from '../../shared/lib';
export interface Permission {
  key: string;
  minimumLevel: 10 | 20 | 30;
}
export const permissionApi = {
  list: (signal?: AbortSignal) =>
    api<Permission[]>('/api/permissions', { signal }),
  update: (key: string, minimumLevel: 10 | 20 | 30) =>
    api(
      `/api/permissions/${encodeURIComponent(key)}`,
      jsonBody({ minimumLevel }, 'PATCH'),
    ),
};

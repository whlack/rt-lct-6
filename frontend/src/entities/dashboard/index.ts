import { api } from '../../shared/api';
export interface Dashboard {
  universities: number;
  activeProjects: number;
  actionRequiredProjects: number;
  calculatedAt: string;
}
export const dashboardApi = {
  get: (signal?: AbortSignal) => api<Dashboard>('/api/dashboard', { signal }),
};

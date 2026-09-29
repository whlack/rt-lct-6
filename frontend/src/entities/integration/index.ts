import { api, queryString, type Page } from '../../shared/api';
export interface Run {
  id: string;
  trigger: 'MANUAL' | 'SCHEDULED';
  status: string;
  createdAt: string;
  completedAt: string | null;
  attempts: number;
  errorCode: string | null;
}
export interface Integration {
  source: 'LMS' | 'WEBSITE';
  availability: 'READY' | 'NOT_IMPLEMENTED';
  intervalSeconds: number;
  nextRunAt: string | null;
  lastRun: Run | null;
  reason: string | null;
}
export const integrationApi = {
  list: (signal?: AbortSignal) =>
    api<Integration[]>('/api/integrations', { signal }),
  runs: (source: Integration['source'], page: number, signal?: AbortSignal) =>
    api<Page<Run>>(
      `/api/integrations/${source}/runs` + queryString({ page, pageSize: 25 }),
      { signal },
    ),
  sync: (source: Integration['source']) =>
    api<{ runId: string }>(`/api/integrations/${source}/sync`, {
      method: 'POST',
    }),
};

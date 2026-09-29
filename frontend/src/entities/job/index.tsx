import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { api, download, queryString, type Page } from '../../shared/api';
import { jsonBody } from '../../shared/lib';
export interface Job {
  id: string;
  kind: 'export' | 'import';
  status: 'QUEUED' | 'RUNNING' | 'PREVIEW' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  progress: number;
  errorCode: string | null;
  expiresAt: string | null;
}
export interface ImportRow {
  id: string;
  sheet: string;
  rowNumber: number;
  key: string;
  data: Record<string, string | number>;
  action: string;
  result: string;
  errors: { column: string; code: string; message: string }[];
}
export interface ImportResult extends Job, Page<ImportRow> {
  phase: 'VALIDATE' | 'APPLY';
  counts: Record<string, number> | null;
}
export const jobNames: Record<Job['status'], string> = {
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  PREVIEW: 'Проверено, ожидает применения',
  SUCCEEDED: 'Готово',
  FAILED: 'Ошибка',
  EXPIRED: 'Срок хранения истёк',
};
export function shouldPoll(status?: Job['status']) {
  return !status || status === 'QUEUED' || status === 'RUNNING';
}
export const jobApi = {
  get: (id: string, signal?: AbortSignal) =>
    api<Job>(`/api/jobs/${id}`, { signal }),
  download: (id: string) => download(`/api/jobs/${id}/file`),
  upload: (file: File) => {
    const body = new FormData();
    body.set('file', file);
    return api<{ id: string }>('/api/catalog-imports', {
      method: 'POST',
      body,
    });
  },
  import: (id: string, page = 1, signal?: AbortSignal) =>
    api<ImportResult>(
      `/api/catalog-imports/${id}` + queryString({ page, pageSize: 25 }),
      { signal },
    ),
  apply: (id: string) => api(`/api/catalog-imports/${id}/apply`, jsonBody({})),
};
interface Queue {
  jobs: { id: string; title: string }[];
  add: (id: string, title: string) => void;
  remove: (id: string) => void;
}
const Context = createContext<Queue | null>(null);
export function JobQueueProvider({ children }: { children: ReactNode }) {
  // This list stores references only. Status and results always come from TanStack Query.
  const [jobs, setJobs] = useState<Queue['jobs']>([]);
  const add = useCallback(
    (id: string, title: string) =>
      setJobs((current) =>
        [
          // Restoring the URL must keep a known export's meaningful title and format.
          { id, title: current.find((job) => job.id === id)?.title ?? title },
          ...current.filter((job) => job.id !== id),
        ].slice(0, 20),
      ),
    [],
  );
  const remove = useCallback(
    (id: string) =>
      setJobs((current) => current.filter((job) => job.id !== id)),
    [],
  );
  const value = useMemo(() => ({ jobs, add, remove }), [jobs, add, remove]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useJobs() {
  const value = useContext(Context);
  if (!value) throw new Error('JobQueueProvider required');
  return value;
}

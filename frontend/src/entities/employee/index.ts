import { api } from '../../shared/api';
import { jsonBody } from '../../shared/lib';
export interface Employee {
  subject: string;
  name?: string;
  email?: string;
}
export interface Visibility {
  mode: 'ALL' | 'ASSIGNED' | 'SELECTED';
  universityIds: string[];
  projectIds: string[];
}
export const employeeApi = {
  list: (signal?: AbortSignal) => api<Employee[]>('/api/employees', { signal }),
  managers: (signal?: AbortSignal) =>
    api<Employee[]>('/api/employees/managers', { signal }),
  visibility: (subject: string, signal?: AbortSignal) =>
    api<Visibility>(`/api/visibility/${subject}`, { signal }),
  setVisibility: (subject: string, body: Visibility) =>
    api(`/api/visibility/${subject}`, jsonBody(body, 'PUT')),
};

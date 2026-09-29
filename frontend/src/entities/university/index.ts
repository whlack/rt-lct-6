import { api, type Named } from '../../shared/api';
import { jsonBody } from '../../shared/lib';
export interface University extends Named {
  primaryContactId: string | null;
  createdAt: string;
  assignments?: { userId: string }[];
}
export interface Contact extends Named {
  email: string | null;
  phone: string | null;
}
export interface Assignee {
  userId: string;
  user: { keycloakSubject: string };
}
export const universityApi = {
  list: (signal?: AbortSignal) =>
    api<University[]>('/api/universities', { signal }),
  get: (id: string, signal?: AbortSignal) =>
    api<University>(`/api/universities/${id}`, { signal }),
  create: (name: string) =>
    api<University>('/api/universities', jsonBody({ name })),
  rename: (id: string, name: string) =>
    api(`/api/universities/${id}`, jsonBody({ name }, 'PATCH')),
  contacts: (id: string, signal?: AbortSignal) =>
    api<Contact[]>(`/api/universities/${id}/contacts`, { signal }),
  contact: (
    id: string,
    body: { name: string; email: string | null; phone: string | null },
    contactId?: string,
  ) =>
    api(
      `/api/universities/${id}/contacts${contactId ? '/' + contactId : ''}`,
      jsonBody(body, contactId ? 'PATCH' : 'POST'),
    ),
  primary: (id: string, contactId: string) =>
    api(
      `/api/universities/${id}/primary-contact`,
      jsonBody({ contactId }, 'PATCH'),
    ),
  assignees: (id: string, signal?: AbortSignal) =>
    api<Assignee[]>(`/api/universities/${id}/assignees`, { signal }),
  assign: (id: string, subject: string) =>
    api(`/api/universities/${id}/assignees`, jsonBody({ subject })),
  unassign: (id: string, subject: string) =>
    api(`/api/universities/${id}/assignees/${subject}`, { method: 'DELETE' }),
};

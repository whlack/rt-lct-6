import {
  api,
  queryString,
  download,
  type Named,
  type Page,
} from '../../shared/api';
import { jsonBody } from '../../shared/lib';
export interface ProjectFilters {
  page?: number;
  pageSize?: number;
  universityId?: string;
  directionId?: string;
  programId?: string;
  productId?: string;
  responsibleSubject?: string;
  status?: string;
  search?: string;
  actionRequired?: 'true';
}
export interface ProjectRow {
  id: string;
  university: Named;
  direction: Named;
  program: Named | null;
  product: Named | null;
  responsibleId: string;
  supervisorId: string | null;
  currentStageIndex: number;
  currentStage: {
    id: string;
    title: string;
    position: number;
    expectedActor: 'KAM' | 'UNIVERSITY';
    expectedContact: Named | null;
  } | null;
  stageCount: number;
  responsible: {
    id: string;
    keycloakSubject: string;
    displayName: string | null;
    email: string | null;
  };
  supervisor: {
    id: string;
    keycloakSubject: string;
    displayName: string | null;
    email: string | null;
  } | null;
  closedAt: string | null;
  createdAt: string;
}
export interface ProjectFile {
  id: string;
  documentTypeId: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: 'ATTACHED' | 'COMPLETED';
}
export interface DocumentType extends Named {
  isRequired: boolean;
}
export interface Stage {
  id: string;
  position: number;
  title: string;
  expectedActor: 'KAM' | 'UNIVERSITY';
  expectedContactId: string | null;
  expectedContact: Named | null;
  documentTypes: DocumentType[];
  files: ProjectFile[];
}
export interface WorkflowInput {
  title: string;
  expectedActor: 'KAM' | 'UNIVERSITY';
  expectedContactId?: string;
  documentTypes: { name: string; isRequired: boolean }[];
}
export interface Project extends Omit<
  ProjectRow,
  'currentStage' | 'stageCount' | 'responsible' | 'supervisor'
> {
  universityId: string;
  workflowLocked: boolean;
  stages: Stage[];
  vendor: string | null;
  contractNumber: string | null;
  licenseSignedAt: string | null;
  licenseExpiresYear: number | null;
  transferStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  responsible: ProjectRow['responsible'];
  supervisor: ProjectRow['supervisor'];
}
export interface ProjectCreate {
  universityId: string;
  directionId: string;
  responsibleSubject: string;
  programId?: string;
  productId?: string;
}
export interface ProjectFields {
  vendor: string | null;
  contractNumber: string | null;
  licenseSignedAt: string | null;
  licenseExpiresYear: number | null;
  transferStatus: Project['transferStatus'];
}
export interface Comment {
  id: string;
  parentId: string | null;
  authorId: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: { displayName: string | null; email: string | null };
}
export interface Event {
  id: string;
  type: string;
  createdAt: string;
  actor: { displayName: string | null; email: string | null };
  details: Record<string, unknown> | null;
}
export interface Activity extends Event {
  project: {
    id: string;
    university: Named;
    program: Named | null;
    product: Named | null;
  };
}
export function offering(project: Pick<ProjectRow, 'program' | 'product'>) {
  return project.program?.name ?? project.product?.name ?? '—';
}
const base = (id: string) => `/api/projects/${id}`;
export const projectApi = {
  activity: (signal?: AbortSignal) =>
    api<Activity[]>('/api/projects/activity', { signal }),
  list: (filters: ProjectFilters = {}, signal?: AbortSignal) =>
    api<Page<ProjectRow>>('/api/projects' + queryString(filters), { signal }),
  get: (id: string, signal?: AbortSignal) => api<Project>(base(id), { signal }),
  create: (body: ProjectCreate) =>
    api<{ id: string }>('/api/projects', jsonBody(body)),
  update: (id: string, body: ProjectFields) =>
    api(base(id), jsonBody(body, 'PATCH')),
  assign: (id: string, role: 'responsible' | 'supervisor', subject: string) =>
    api(`${base(id)}/${role}`, jsonBody({ subject }, 'PATCH')),
  workflow: (id: string, stages: WorkflowInput[]) =>
    api(`${base(id)}/workflow`, jsonBody({ stages }, 'PATCH')),
  advance: (id: string, stageId: string) =>
    api(`${base(id)}/advance`, jsonBody({ expectedStageId: stageId })),
  close: (id: string) => api(`${base(id)}/close`, jsonBody({})),
  comments: (id: string, signal?: AbortSignal) =>
    api<Comment[]>(`${base(id)}/comments`, { signal }),
  comment: (id: string, body: string, parentId?: string, commentId?: string) =>
    api(
      `${base(id)}/comments${commentId ? '/' + commentId : ''}`,
      jsonBody(
        commentId ? { body } : { body, parentId },
        commentId ? 'PATCH' : 'POST',
      ),
    ),
  deleteComment: (id: string, commentId: string) =>
    api(`${base(id)}/comments/${commentId}`, { method: 'DELETE' }),
  history: (id: string, signal?: AbortSignal) =>
    api<Event[]>(`${base(id)}/history`, { signal }),
  upload: (id: string, stageId: string, typeId: string, file: File) => {
    const body = new FormData();
    body.set('file', file);
    return api(`${base(id)}/stages/${stageId}/document-types/${typeId}/files`, {
      method: 'POST',
      body,
    });
  },
  download: (id: string, fileId: string) =>
    download(`${base(id)}/files/${fileId}`),
  complete: (id: string, fileId: string) =>
    api(`${base(id)}/files/${fileId}/complete`, jsonBody({})),
};

export const eventNames: Record<string, string> = {
  PROJECT_CREATED: 'Проект создан',
  PROJECT_UPDATED: 'Сведения проекта изменены',
  LICENSE_SIGNED: 'Подписание лицензии',
  RESPONSIBLE_CHANGED: 'Ответственный КАМ изменён',
  SUPERVISOR_CHANGED: 'Руководитель изменён',
  WORKFLOW_CONFIGURED: 'Workflow настроен',
  STAGE_ADVANCED: 'Переход на следующий этап',
  PROJECT_CLOSED: 'Проект закрыт',
  FILE_ATTACHED: 'Документ прикреплён',
  FILE_COMPLETED: 'Документ отмечен завершённым',
  COMMENT_CREATED: 'Комментарий добавлен',
  COMMENT_UPDATED: 'Комментарий изменён',
  COMMENT_DELETED: 'Комментарий удалён',
};

export function eventTitle(
  event: Pick<Event, 'type' | 'details'>,
  stageNames?: ReadonlyMap<string, string>,
): string {
  if (event.type === 'STAGE_ADVANCED') {
    const from =
      typeof event.details?.fromTitle === 'string'
        ? event.details.fromTitle
        : stageNames?.get(String(event.details?.from ?? ''));
    const to =
      typeof event.details?.toTitle === 'string'
        ? event.details.toTitle
        : stageNames?.get(String(event.details?.to ?? ''));
    if (from && to) return `Переход: ${from} → ${to}`;
  }
  return eventNames[event.type] ?? 'Изменение проекта';
}

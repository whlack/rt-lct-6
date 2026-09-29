import { api, queryString, type Named, type Page } from '../../shared/api';
import { jsonBody } from '../../shared/lib';
export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  universityId?: string;
  directionId?: string;
  programId?: string;
  productId?: string;
  responsibleSubject?: string;
  status?: string;
}
export interface ReportRow {
  id: string;
  university: Named;
  direction: Named;
  offering: Named & { type: 'PROGRAM' | 'PRODUCT' };
  status: 'ACTIVE' | 'CLOSED';
  currentStage: { title: string } | null;
  responsible: { displayName: string | null; email: string | null };
  supervisor: { displayName: string | null; email: string | null } | null;
  createdAt: string;
  closedAt: string | null;
  vendor: string | null;
  contractNumber: string | null;
  licenseSignedAt: string | null;
  licenseExpiresYear: number | null;
  transferStatus: string;
}
export interface Statistics {
  generatedAt: string;
  timezone: string;
  status: { active: number; closed: number };
  directions: { id: string; name: string; count: number }[];
  months: { month: string; created: number; closed: number }[];
}
export const columns = [
  ['id', 'ID проекта'],
  ['university', 'Вуз'],
  ['direction', 'Направление'],
  ['offeringType', 'Тип'],
  ['offering', 'Программа / продукт'],
  ['status', 'Статус'],
  ['stage', 'Этап'],
  ['responsible', 'Ответственный'],
  ['supervisor', 'Руководитель'],
  ['createdAt', 'Дата создания'],
  ['closedAt', 'Дата закрытия'],
  ['vendor', 'Вендор'],
  ['contractNumber', 'Договор'],
  ['licenseSignedAt', 'Подписание лицензии'],
  ['licenseExpiresYear', 'Срок лицензии'],
  ['transferStatus', 'Передача'],
] as const;
export type ReportColumn = (typeof columns)[number][0];
export type ReportFormat = 'xls' | 'xlsx' | 'pdf' | 'json';
export const templates: {
  title: string;
  description: string;
  columns: ReportColumn[];
}[] = [
  {
    title: 'Взаимодействия с вузами',
    description: 'Проекты, статусы и ответственные',
    columns: ['university', 'offering', 'responsible', 'stage', 'status'],
  },
  {
    title: 'Прогресс проектов',
    description: 'Текущие этапы и статусы',
    columns: ['university', 'offering', 'stage', 'status', 'createdAt'],
  },
  {
    title: 'Программы и продукты',
    description: 'Направления и предложения',
    columns: ['university', 'direction', 'offeringType', 'offering', 'status'],
  },
  {
    title: 'Проекты команды',
    description: 'Ответственные и руководители',
    columns: ['university', 'offering', 'responsible', 'supervisor', 'status'],
  },
  {
    title: 'Договоры и лицензии',
    description: 'Вендоры, договоры и сроки',
    columns: [
      'university',
      'offering',
      'vendor',
      'contractNumber',
      'licenseSignedAt',
      'licenseExpiresYear',
      'transferStatus',
    ],
  },
];
export function validateReportFilters(filters: ReportFilters) {
  if (Boolean(filters.dateFrom) !== Boolean(filters.dateTo))
    return 'Укажите обе даты периода.';
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)
    return 'Дата начала должна быть не позже даты окончания.';
  if (filters.programId && filters.productId)
    return 'Выберите программу или продукт.';
  return '';
}
export const reportApi = {
  list: (filters: ReportFilters, page: number, signal?: AbortSignal) =>
    api<Page<ReportRow>>(
      '/api/reports/projects' + queryString({ ...filters, page, pageSize: 25 }),
      { signal },
    ),
  export: (
    body: {
      format: ReportFormat;
      columns?: ReportColumn[];
      projectId?: string;
    } & ReportFilters,
  ) => api<{ id: string }>('/api/reports/exports', jsonBody(body)),
  statistics: (filters: ReportFilters, signal?: AbortSignal) =>
    api<Statistics>('/api/statistics' + queryString(filters), { signal }),
  chart: (filters: ReportFilters, format: 'png' | 'pdf') =>
    api<{ id: string }>(
      '/api/statistics/exports',
      jsonBody({ ...filters, format }),
    ),
};

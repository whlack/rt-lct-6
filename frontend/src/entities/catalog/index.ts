import { api, type Named } from '../../shared/api';
import { jsonBody } from '../../shared/lib';
export type CatalogKind = 'directions' | 'programs' | 'products';
export const catalogNames: Record<CatalogKind, string> = {
  directions: 'ИТ-направления',
  programs: 'Программы',
  products: 'Продукты',
};
export const catalogApi = {
  list: (kind: CatalogKind, signal?: AbortSignal) =>
    api<Named[]>(`/api/catalogs/${kind}`, { signal }),
  save: (kind: CatalogKind, name: string, id?: string) =>
    api<Named>(
      `/api/catalogs/${kind}${id ? '/' + id : ''}`,
      jsonBody({ name }, id ? 'PATCH' : 'POST'),
    ),
};

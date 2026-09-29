import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { projectApi } from '../../entities/project';
import { catalogApi } from '../../entities/catalog';
import { useSession } from '../../features/session';
import { ProjectCreateForm } from '../../features/project-create';
import { ProjectTable } from '../../widgets/project-table';
import { PageHeader, Panel, Pagination, QueryState } from '../../shared/ui';
export function ProjectsPage() {
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(false);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters = {
    page,
    pageSize: 25,
    search: params.get('search') ?? '',
    status: params.get('status') ?? '',
    directionId: params.get('directionId') ?? '',
    actionRequired:
      params.get('actionRequired') === 'true' ? ('true' as const) : undefined,
  };
  const projects = useQuery({
    queryKey: ['projects', filters],
    queryFn: ({ signal }) => projectApi.list(filters, signal),
  });
  const directions = useQuery({
    queryKey: ['catalogs', 'directions'],
    queryFn: ({ signal }) => catalogApi.list('directions', signal),
    enabled: can('catalogs.read'),
  });
  function change(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }
  return (
    <>
      <PageHeader
        title="Проекты"
        subtitle="Программы и продукты в работе с вузами"
      >
        {can('projects.create') && (
          <button
            className="button button-primary"
            onClick={() => setCreate(true)}
          >
            + Новый проект
          </button>
        )}
      </PageHeader>
      <Panel>
        <div className="filter-grid">
          <label className="field">
            <span>Поиск</span>
            <input
              aria-label="Поиск проектов"
              placeholder="Вуз, направление, программа, договор"
              value={filters.search}
              maxLength={200}
              onChange={(event) => change('search', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Статус</span>
            <select
              value={filters.status}
              onChange={(event) => change('status', event.target.value)}
            >
              <option value="">Все статусы</option>
              <option value="ACTIVE">Активные</option>
              <option value="CLOSED">Закрытые</option>
            </select>
          </label>
          {can('catalogs.read') && (
            <label className="field">
              <span>Направление</span>
              <select
                value={filters.directionId}
                onChange={(event) => change('directionId', event.target.value)}
              >
                <option value="">Все направления</option>
                {directions.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(filters.actionRequired)}
            onChange={(event) =>
              change('actionRequired', event.target.checked ? 'true' : '')
            }
          />
          Только ожидающие действия КАМ
        </label>
        <QueryState query={projects} />
        {projects.data && (
          <>
            <ProjectTable rows={projects.data.rows} />
            <Pagination
              page={page}
              total={projects.data.total}
              size={25}
              onChange={(value) => change('page', String(value))}
            />
          </>
        )}
      </Panel>
      {create && <ProjectCreateForm onClose={() => setCreate(false)} />}
    </>
  );
}

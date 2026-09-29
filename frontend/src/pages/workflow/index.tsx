import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { projectApi, offering } from '../../entities/project';
import { ProjectWorkflow } from '../../features/project-workflow';
import { PageHeader, Panel, Pagination, QueryState } from '../../shared/ui';
export function WorkflowPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const id = params.get('project') ?? '';
  const search = params.get('search') ?? '';
  const projects = useQuery({
    queryKey: ['projects', { page, search, status: 'ACTIVE' }],
    queryFn: ({ signal }) =>
      projectApi.list({ page, pageSize: 25, search, status: 'ACTIVE' }, signal),
  });
  const project = useQuery({
    queryKey: ['projects', id],
    queryFn: ({ signal }) => projectApi.get(id, signal),
    enabled: Boolean(id),
  });
  return (
    <>
      <PageHeader
        title="Процессы"
        subtitle="Workflow настраивается отдельно для каждого проекта"
      />
      <Panel>
        <label className="field">
          <span>Найти проект</span>
          <input
            value={search}
            onChange={(event) => setParams({ search: event.target.value })}
          />
        </label>
        <QueryState query={projects} />
        {projects.data && (
          <>
            <div className="list-stack">
              {projects.data.rows.map((item) => (
                <button
                  className={`project-selector ${item.id === id ? 'selected' : ''}`}
                  key={item.id}
                  onClick={() =>
                    setParams({
                      ...(search ? { search } : {}),
                      page: String(page),
                      project: item.id,
                    })
                  }
                >
                  <strong>{offering(item)}</strong>
                  <span>
                    {item.university.name} · {item.currentStage?.title}
                  </span>
                </button>
              ))}
            </div>
            <Pagination
              page={page}
              total={projects.data.total}
              size={25}
              onChange={(value) =>
                setParams({
                  ...(search ? { search } : {}),
                  page: String(value),
                  ...(id ? { project: id } : {}),
                })
              }
            />
          </>
        )}
      </Panel>
      {id && (
        <>
          <QueryState query={project} />
          {project.data && (
            <>
              <div className="flex justify-between">
                <h2>{offering(project.data)}</h2>
                <Link className="text-link" to={`/projects/${id}`}>
                  Открыть карточку →
                </Link>
              </div>
              <ProjectWorkflow project={project.data} />
            </>
          )}
        </>
      )}
    </>
  );
}

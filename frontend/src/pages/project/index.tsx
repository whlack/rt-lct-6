import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { projectApi, offering } from '../../entities/project';
import { ProjectWorkflow } from '../../features/project-workflow';
import {
  ProjectFieldsPanel,
  ProjectAssignments,
} from '../../features/project-fields';
import { ProjectComments } from '../../features/project-comments';
import { ProjectFiles } from '../../features/project-files';
import { ProjectExport } from '../../features/project-export';
import { useSession } from '../../features/session';
import { ProjectHistory } from '../../widgets/project-history';
import { Badge, PageHeader, QueryState } from '../../shared/ui';
export function ProjectPage() {
  const id = useParams().id!;
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const tabs = [
    ['overview', 'Обзор'],
    ['workflow', 'Этапы'],
    ['documents', 'Документы'],
    ['comments', 'Комментарии'],
    ['history', 'История'],
  ];
  const tab = tabs.some(([key]) => key === params.get('tab'))
    ? params.get('tab')!
    : 'overview';
  const query = useQuery({
    queryKey: ['projects', id],
    queryFn: ({ signal }) => projectApi.get(id, signal),
  });

  if (!query.data) return <QueryState query={query} />;
  const project = query.data;
  return (
    <div className="content-stack entity-profile program-workspace">
      <div className="entity-profile-actions">
        <Link className="text-link" to="/projects">
          ← Реестр проектов
        </Link>
        <Link
          className="text-link"
          to={`/universities/${project.university.id}`}
        >
          {project.university.name} ↗
        </Link>
      </div>
      <PageHeader
        title={offering(project)}
        subtitle={`${project.direction.name} · ${project.program ? 'Программа' : 'Продукт'}`}
      >
        <Badge>{project.closedAt ? 'Закрыт' : 'Активен'}</Badge>
        {can('reports.export') && (
          <ProjectExport id={id} title={offering(project)} />
        )}
      </PageHeader>
      <nav className="entity-tabs" aria-label="Разделы карточки">
        {tabs.map(([key, title]) => (
          <button
            key={key}
            className="button"
            aria-pressed={key === tab}
            onClick={() => setParams({ tab: key })}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <>
          <div className="detail-grid">
            <ProjectFieldsPanel project={project} />
            <ProjectAssignments project={project} />
          </div>
          <ProjectWorkflow project={project} />
        </>
      )}
      {tab === 'workflow' && <ProjectWorkflow project={project} />}{' '}
      {tab === 'documents' && <ProjectFiles project={project} />}{' '}
      {tab === 'comments' && (
        <ProjectComments id={id} closed={Boolean(project.closedAt)} />
      )}{' '}
      {tab === 'history' && <ProjectHistory id={id} stages={project.stages} />}
    </div>
  );
}

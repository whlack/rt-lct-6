import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { universityApi } from '../../entities/university';
import { projectApi, offering } from '../../entities/project';
import { useSession } from '../../features/session';
import { UniversityContacts } from '../../features/university-contacts';
import { UniversityAssignees } from '../../features/university-assignees';
import { ProjectCreateForm } from '../../features/project-create';
import { ProjectFiles } from '../../features/project-files';
import { ProjectWorkflow } from '../../features/project-workflow';
import { ProjectTable } from '../../widgets/project-table';
import { ProjectHistory } from '../../widgets/project-history';
import { useAction, formText } from '../../shared/lib';
import {
  ActionState,
  Badge,
  Field,
  Form,
  Modal,
  PageHeader,
  Panel,
  Pagination,
  QueryState,
  Submit,
} from '../../shared/ui';
const tabs = [
  ['overview', 'Обзор'],
  ['projects', 'Проекты'],
  ['contacts', 'Контакты'],
  ['documents', 'Документы'],
  ['tasks', 'Действия'],
  ['history', 'История'],
];
export function UniversityPage() {
  const id = useParams().id!;
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const tab = tabs.some(([key]) => key === params.get('tab'))
    ? params.get('tab')!
    : 'overview';
  const [edit, setEdit] = useState(false);
  const [create, setCreate] = useState(false);
  const university = useQuery({
    queryKey: ['universities', id],
    queryFn: ({ signal }) => universityApi.get(id, signal),
  });
  const projects = useQuery({
    queryKey: ['projects', { universityId: id, page }],
    queryFn: ({ signal }) =>
      projectApi.list({ universityId: id, page, pageSize: 25 }, signal),
    enabled: can('projects.read'),
  });
  const contacts = useQuery({
    queryKey: ['contacts', id],
    queryFn: ({ signal }) => universityApi.contacts(id, signal),
    enabled: can('university_contacts.read'),
  });
  const selected = params.get('project') ?? projects.data?.rows[0]?.id ?? '';
  const detailTab = ['documents', 'tasks', 'history'].includes(tab);
  const project = useQuery({
    queryKey: ['projects', selected],
    queryFn: ({ signal }) => projectApi.get(selected, signal),
    enabled: can('projects.read') && Boolean(selected) && detailTab,
  });
  const rename = useAction(
    (name: string) => universityApi.rename(id, name),
    ['universities', 'projects'],
  );
  function patch(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });
  }
  if (!university.data) return <QueryState query={university} />;
  const primary = contacts.data?.find(
    (item) => item.id === university.data.primaryContactId,
  );
  return (
    <div className="content-stack entity-profile university-workspace">
      <Link className="text-link" to="/universities">
        ← Реестр вузов
      </Link>
      <PageHeader title={university.data.name} subtitle="Вуз-партнёр">
        {projects.data && <Badge>{projects.data.total} проектов</Badge>}
        {can('universities.update') && (
          <button className="button" onClick={() => setEdit(true)}>
            Изменить название
          </button>
        )}
        {can('projects.create') && (
          <button
            className="button button-primary"
            onClick={() => setCreate(true)}
          >
            + Проект
          </button>
        )}
      </PageHeader>
      <nav className="entity-tabs" aria-label="Разделы карточки вуза">
        {tabs
          .filter(
            ([key]) => key !== 'contacts' || can('university_contacts.read'),
          )
          .map(([key, title]) => (
            <button
              key={key}
              className="button"
              aria-pressed={tab === key}
              onClick={() => patch('tab', key)}
            >
              {title}
            </button>
          ))}
      </nav>
      {tab === 'overview' && (
        <>
          <Panel>
            <dl className="details-list">
              <dt>Основной контакт</dt>
              <dd>{primary?.name ?? 'Не назначен'}</dd>
              <dt>Email</dt>
              <dd>{primary?.email ?? '—'}</dd>
              <dt>Телефон</dt>
              <dd>{primary?.phone ?? '—'}</dd>
              <dt>Ответственные КАМ</dt>
              <dd>{university.data.assignments?.length ?? 0}</dd>
            </dl>
          </Panel>
          <div className="detail-grid">
            <UniversityContacts
              id={id}
              primaryContactId={university.data.primaryContactId}
            />
            {can('universities.assignees.manage') && (
              <UniversityAssignees id={id} />
            )}
          </div>
        </>
      )}
      {tab === 'contacts' && (
        <UniversityContacts
          id={id}
          primaryContactId={university.data.primaryContactId}
        />
      )}{' '}
      {['overview', 'projects'].includes(tab) && can('projects.read') && (
        <Panel>
          <h2>Проекты вуза</h2>
          <QueryState query={projects} />
          {projects.data && (
            <>
              <ProjectTable rows={projects.data.rows} />
              <Pagination
                page={page}
                total={projects.data.total}
                size={25}
                onChange={(value) => patch('page', String(value))}
              />
            </>
          )}
        </Panel>
      )}
      {detailTab && can('projects.read') && (
        <>
          <Panel>
            <Field label="Проект">
              <select
                value={selected}
                onChange={(event) => patch('project', event.target.value)}
              >
                {projects.data?.rows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {offering(item)}
                  </option>
                ))}
              </select>
            </Field>
            <QueryState query={projects} />
            {projects.data && (
              <Pagination
                page={page}
                total={projects.data.total}
                size={25}
                onChange={(value) => patch('page', String(value))}
              />
            )}
            <p className="muted">
              Документы, действия и история относятся к выбранному проекту.
            </p>
          </Panel>
          {selected && <QueryState query={project} />}{' '}
          {project.data?.universityId === id && (
            <>
              {tab === 'documents' && <ProjectFiles project={project.data} />}{' '}
              {tab === 'tasks' && <ProjectWorkflow project={project.data} />}{' '}
              {tab === 'history' && (
                <ProjectHistory id={selected} stages={project.data.stages} />
              )}
            </>
          )}
        </>
      )}
      {edit && (
        <Modal title="Название вуза" onClose={() => setEdit(false)}>
          <Form
            onSubmit={(data) =>
              rename.mutate(formText(data, 'name'), {
                onSuccess: () => setEdit(false),
              })
            }
          >
            <Field label="Название">
              <input
                name="name"
                defaultValue={university.data.name}
                required
                maxLength={250}
              />
            </Field>
            <ActionState action={rename} />
            <Submit pending={rename.isPending} />
          </Form>
        </Modal>
      )}
      {create && (
        <ProjectCreateForm universityId={id} onClose={() => setCreate(false)} />
      )}
    </div>
  );
}

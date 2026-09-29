import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../entities/dashboard';
import { projectApi, offering, eventNames } from '../../entities/project';
import { useSession } from '../../features/session';
import { ProjectTable } from '../../widgets/project-table';
import { date, employeeName } from '../../shared/lib';
import {
  Empty,
  LineIcon,
  PageHeader,
  Panel,
  QueryState,
} from '../../shared/ui';
export function DashboardPage() {
  const { can, user } = useSession();
  const [eventType, setEventType] = useState('all');
  const [mobile, setMobile] = useState('tasks');
  const [dashboard, projects, attention, activity] = useQueries({
    queries: [
      {
        queryKey: ['dashboard'],
        queryFn: ({ signal }) => dashboardApi.get(signal),
        refetchInterval: 60_000,
      },
      {
        queryKey: ['projects', { page: 1, pageSize: 10 }],
        queryFn: ({ signal }) =>
          projectApi.list({ page: 1, pageSize: 10 }, signal),
        enabled: can('projects.read'),
      },
      {
        queryKey: [
          'projects',
          { page: 1, pageSize: 5, actionRequired: 'true' },
        ],
        queryFn: ({ signal }) =>
          projectApi.list(
            { page: 1, pageSize: 5, actionRequired: 'true' },
            signal,
          ),
        enabled: can('projects.read'),
      },
      {
        queryKey: ['activity'],
        queryFn: ({ signal }) => projectApi.activity(signal),
        enabled: can('projects.read'),
      },
    ],
  });
  const events =
    activity.data?.filter((event) => {
      if (eventType === 'all') return true;
      if (eventType === 'files') return event.type.startsWith('FILE_');
      if (eventType === 'comments') return event.type.startsWith('COMMENT_');
      return event.type === 'STAGE_ADVANCED';
    }) ?? [];

  return (
    <>
      <PageHeader
        title="Моя работа"
        subtitle={`Здравствуйте, ${employeeName(user)}. Здесь собраны проекты и действия команды.`}
      />
      <div className="glass-dashboard" data-mobile-section={mobile}>
        <QueryState query={dashboard} />
        {dashboard.data && (
          <section className="glass-metrics" aria-label="Показатели CRM">
            {[
              [
                'Вузы-партнёры',
                dashboard.data.universities,
                '/universities',
                'universities',
                'universities.read',
              ],
              [
                'Активные проекты',
                dashboard.data.activeProjects,
                '/projects?status=ACTIVE',
                'project',
                'projects.read',
              ],
              [
                'Требуют действия',
                dashboard.data.actionRequiredProjects,
                '/projects?actionRequired=true',
                'bell',
                'projects.read',
              ],
            ].map(([title, value, path, icon, permission]) => (
              <article key={String(title)}>
                <span className="metric-icon">
                  <LineIcon name={String(icon)} />
                </span>
                <span>{title}</span>
                <strong>{value}</strong>
                {can(String(permission)) && (
                  <Link className="text-link" to={String(path)}>
                    Открыть →
                  </Link>
                )}
              </article>
            ))}
          </section>
        )}
        {can('projects.read') && (
          <>
            <div
              className="dashboard-mobile-sections"
              aria-label="Раздел обзора"
            >
              {[
                ['tasks', 'Задачи'],
                ['activity', 'События'],
                ['steps', 'Шаги'],
                ['connections', 'Связи'],
                ['status', 'Статусы'],
              ].map(([key, title]) => (
                <button
                  key={key}
                  aria-pressed={mobile === key}
                  onClick={() => setMobile(key)}
                >
                  {title}
                </button>
              ))}
            </div>
            <div className="dashboard-work-grid">
              <section className="attention-center dashboard-card">
                <header className="dashboard-card-heading">
                  <h2>Требуют действия</h2>
                  <LineIcon name="bell" />
                </header>
                <p className="dashboard-section-caption">
                  Текущий этап ожидает КАМ
                </p>
                <QueryState query={attention} />
                {attention.data &&
                  (!attention.data.rows.length ? (
                    <Empty>Нет проектов, ожидающих действия КАМ.</Empty>
                  ) : (
                    <div className="list-stack">
                      {attention.data.rows.map((project) => (
                        <Link
                          className="attention-project"
                          key={project.id}
                          to={`/projects/${project.id}`}
                        >
                          <strong>{offering(project)}</strong>
                          <p>{project.university.name}</p>
                          <small>
                            {project.currentStage?.title} ·{' '}
                            {employeeName(project.responsible)}
                          </small>
                        </Link>
                      ))}
                    </div>
                  ))}
                <Link className="text-link" to="/projects?actionRequired=true">
                  Все ожидающие проекты →
                </Link>
              </section>
              <section className="attention-activity dashboard-card">
                <header className="dashboard-card-heading">
                  <h2>Активность команды</h2>
                  <select
                    aria-label="Тип события"
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                  >
                    <option value="all">Все события</option>
                    <option value="stages">Этапы</option>
                    <option value="files">Документы</option>
                    <option value="comments">Комментарии</option>
                  </select>
                </header>
                <p className="dashboard-section-caption">
                  Последние 25 событий видимых проектов
                </p>
                <QueryState query={activity} />
                <div className="activity-timeline">
                  {events.slice(0, 5).map((event) => (
                    <Link
                      className="activity-entry"
                      key={event.id}
                      to={`/projects/${event.project.id}?tab=history`}
                    >
                      <span className="activity-glyph">
                        <LineIcon
                          name={
                            event.type.startsWith('FILE_')
                              ? 'document'
                              : event.type.startsWith('COMMENT_')
                                ? 'comment'
                                : 'workflow'
                          }
                        />
                      </span>
                      <span className="activity-copy">
                        <strong>
                          {eventNames[event.type] ?? 'Изменение проекта'}
                        </strong>
                        <p>
                          {offering(event.project)} ·{' '}
                          {employeeName(event.actor)}
                        </p>
                        <small>{date(event.createdAt)}</small>
                      </span>
                    </Link>
                  ))}
                </div>
                {activity.data && !events.length && (
                  <Empty>Событий этого типа пока нет.</Empty>
                )}
              </section>
              <aside className="dashboard-side-column">
                <section className="dashboard-card next-steps-card">
                  <header className="dashboard-card-heading">
                    <h2>Ближайшие шаги</h2>
                    <LineIcon name="calendar" />
                  </header>
                  <p className="dashboard-section-caption">
                    В последних проектах
                  </p>
                  {projects.data?.rows
                    .filter((project) => !project.closedAt)
                    .slice(0, 3)
                    .map((project) => (
                      <Link
                        className="dashboard-next-step"
                        key={project.id}
                        to={`/projects/${project.id}`}
                      >
                        <span className="next-step-glyph">
                          <LineIcon name="workflow" />
                        </span>
                        <span>
                          <small>{offering(project)}</small>
                          <strong>{project.currentStage?.title}</strong>
                          <em>{project.university.name}</em>
                        </span>
                        <LineIcon name="arrow" />
                      </Link>
                    ))}
                  {can('universities.read') && (
                    <Link className="dashboard-partner-card" to="/universities">
                      <span>
                        <strong>Вузы и проекты</strong>
                        <small>Открыть реестр →</small>
                      </span>
                      <span className="partner-ribbon" />
                    </Link>
                  )}
                </section>
              </aside>
            </div>
            <div className="dashboard-analytics-grid">
              <Panel className="collaboration-map">
                <h2>Связи проектов</h2>
                <p className="muted">
                  Последние 10 проектов · вуз, программа или продукт, текущий
                  этап
                </p>
                <QueryState query={projects} />
                {projects.data && <ProjectTable rows={projects.data.rows} />}
              </Panel>
              <Panel className="dashboard-card dashboard-project-summary">
                <h2>Статусы</h2>
                <p className="muted">Все видимые активные проекты</p>
                <div className="stats-summary">
                  <div>
                    <span>Ожидают КАМ</span>
                    <strong>
                      {dashboard.data?.actionRequiredProjects ?? '—'}
                    </strong>
                  </div>
                  <div>
                    <span>Ожидают вуз</span>
                    <strong>
                      {dashboard.data
                        ? dashboard.data.activeProjects -
                          dashboard.data.actionRequiredProjects
                        : '—'}
                    </strong>
                  </div>
                </div>
                {can('reports.read') && (
                  <Link className="text-link" to="/reports">
                    Открыть отчёты →
                  </Link>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </>
  );
}

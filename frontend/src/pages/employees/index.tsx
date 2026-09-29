import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  employeeApi,
  type Employee,
  type Visibility,
} from '../../entities/employee';
import { permissionApi, type Permission } from '../../entities/permission';
import { universityApi } from '../../entities/university';
import { projectApi, offering } from '../../entities/project';
import { useSession } from '../../features/session';
import { useAction, employeeName } from '../../shared/lib';
import {
  ActionState,
  Empty,
  Field,
  Form,
  PageHeader,
  Panel,
  Pagination,
  QueryState,
  Submit,
} from '../../shared/ui';
export function EmployeesPage() {
  const { can } = useSession();
  const [subject, setSubject] = useState('');
  const employees = useQuery({
    queryKey: ['employees'],
    queryFn: ({ signal }) => employeeApi.list(signal),
    enabled:
      can('visibility.manage') &&
      (can('projects.create') || can('universities.assignees.manage')),
  });
  return (
    <>
      <PageHeader
        title="Сотрудники и права"
        subtitle="Доступ КАМ и минимальные уровни для операций"
      />
      <Panel>
        <h2>Учётные записи</h2>
        <p className="muted">
          Рабочие аккаунты и роли управляются в корпоративном каталоге.
          Ответственных за вуз и проект назначайте в соответствующей карточке.
        </p>
      </Panel>
      {can('visibility.manage') && (
        <>
          <Panel>
            <h2>Видимость КАМ</h2>
            <p className="muted">
              Ограничения действуют только на КАМ. Руководители КАМ и
              администраторы видят все данные.
            </p>
            <QueryState query={employees} />
            {employees.data && (
              <Field label="Сотрудник">
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                >
                  <option value="">Выберите КАМ</option>
                  {employees.data.map((employee) => (
                    <option key={employee.subject} value={employee.subject}>
                      {employeeName(employee)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {employees.data?.length === 0 && <Empty>В каталоге нет КАМ.</Empty>}
          </Panel>
          {subject && (
            <VisibilityPanel
              key={subject}
              employee={
                employees.data?.find((item) => item.subject === subject) ?? {
                  subject,
                }
              }
            />
          )}
        </>
      )}
      {can('permissions.manage') && <PermissionsPanel />}
    </>
  );
}
function VisibilityPanel({ employee }: { employee: Employee }) {
  const query = useQuery({
    queryKey: ['visibility', employee.subject],
    queryFn: ({ signal }) => employeeApi.visibility(employee.subject, signal),
  });
  return (
    <Panel>
      <h2>Доступ: {employeeName(employee)}</h2>
      <QueryState query={query} />
      {query.data && (
        <VisibilityForm employee={employee} initial={query.data} />
      )}
    </Panel>
  );
}
function VisibilityForm({
  employee,
  initial,
}: {
  employee: Employee;
  initial: Visibility;
}) {
  const [mode, setMode] = useState(initial.mode);
  const [universityIds, setUniversityIds] = useState(initial.universityIds);
  const [projectIds, setProjectIds] = useState(initial.projectIds);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const universities = useQuery({
    queryKey: ['universities'],
    queryFn: ({ signal }) => universityApi.list(signal),
    enabled: mode === 'SELECTED',
  });
  const projects = useQuery({
    queryKey: ['projects', { search, page }],
    queryFn: ({ signal }) =>
      projectApi.list({ search, page, pageSize: 25 }, signal),
    enabled: mode === 'SELECTED',
  });
  const action = useAction(
    (body: Visibility) => employeeApi.setVisibility(employee.subject, body),
    [
      'visibility',
      'session',
      'universities',
      'projects',
      'reports',
      'statistics',
      'dashboard',
    ],
  );
  function toggle(items: string[], id: string) {
    return items.includes(id)
      ? items.filter((item) => item !== id)
      : [...items, id];
  }
  return (
    <Form
      onSubmit={() =>
        action.mutate({
          mode,
          universityIds: mode === 'SELECTED' ? universityIds : [],
          projectIds: mode === 'SELECTED' ? projectIds : [],
        })
      }
    >
      <Field label="Режим доступа">
        <select
          value={mode}
          onChange={(event) =>
            setMode(
              event.target.value === 'ALL'
                ? 'ALL'
                : event.target.value === 'SELECTED'
                  ? 'SELECTED'
                  : 'ASSIGNED',
            )
          }
        >
          <option value="ASSIGNED">По назначениям</option>
          <option value="ALL">Все данные</option>
          <option value="SELECTED">Список разрешённых вузов и проектов</option>
        </select>
      </Field>
      {mode === 'ASSIGNED' && (
        <p className="muted">Доступ к назначенным вузам и проектам.</p>
      )}
      {mode === 'SELECTED' && (
        <>
          <p className="muted">
            Разрешённый вуз открывает его проекты. Проект можно разрешить
            отдельно. Пустой список закрывает доступ.
          </p>
          <QueryState query={universities} />
          <fieldset className="selection-list">
            <legend>Разрешённые вузы · {universityIds.length}</legend>
            {universities.data?.map((item) => (
              <label className="checkbox-label" key={item.id}>
                <input
                  type="checkbox"
                  checked={universityIds.includes(item.id)}
                  onChange={() =>
                    setUniversityIds((current) => toggle(current, item.id))
                  }
                />
                {item.name}
              </label>
            ))}
          </fieldset>
          <Field label="Поиск проектов">
            <input
              value={search}
              maxLength={200}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <QueryState query={projects} />
          <fieldset className="selection-list">
            <legend>Разрешённые проекты · {projectIds.length}</legend>
            {projects.data?.rows.map((item) => (
              <label className="checkbox-label" key={item.id}>
                <input
                  type="checkbox"
                  checked={projectIds.includes(item.id)}
                  onChange={() =>
                    setProjectIds((current) => toggle(current, item.id))
                  }
                />
                {item.university.name} · {offering(item)}
              </label>
            ))}
          </fieldset>
          {projects.data && (
            <Pagination
              page={page}
              total={projects.data.total}
              size={25}
              onChange={setPage}
            />
          )}
          <button
            className="button"
            type="button"
            onClick={() => {
              setUniversityIds([]);
              setProjectIds([]);
            }}
          >
            Очистить разрешённый список
          </button>
        </>
      )}
      <Submit pending={action.isPending}>Сохранить доступ</Submit>
      <ActionState action={action} />
    </Form>
  );
}
function PermissionsPanel() {
  const query = useQuery({
    queryKey: ['permissions'],
    queryFn: ({ signal }) => permissionApi.list(signal),
  });
  return (
    <Panel>
      <h2>Уровни прав</h2>
      <p className="muted">
        Роль сотрудника должна быть не ниже указанного уровня. Управление
        правами и видимостью доступно только администратору.
      </p>
      <QueryState query={query} />
      {query.data?.map((permission) => (
        <PermissionRow
          key={`${permission.key}-${permission.minimumLevel}`}
          permission={permission}
        />
      ))}
    </Panel>
  );
}
function PermissionRow({ permission }: { permission: Permission }) {
  const [level, setLevel] = useState(permission.minimumLevel);
  const fixed =
    permission.key === 'permissions.manage' ||
    permission.key === 'visibility.manage';
  const action = useAction(
    () => permissionApi.update(permission.key, level),
    ['permissions', 'session'],
  );
  return (
    <Form className="permission-row" onSubmit={() => action.mutate(undefined)}>
      <Field label={permissionLabels[permission.key] ?? permission.key}>
        <select
          value={level}
          disabled={fixed}
          onChange={(event) =>
            setLevel(
              event.target.value === '30'
                ? 30
                : event.target.value === '20'
                  ? 20
                  : 10,
            )
          }
        >
          <option value={10}>КАМ</option>
          <option value={20}>Руководитель КАМ</option>
          <option value={30}>Администратор</option>
        </select>
      </Field>
      {!fixed && (
        <Submit
          pending={action.isPending}
          disabled={level === permission.minimumLevel}
        />
      )}
      <ActionState action={action} />
    </Form>
  );
}
const permissionLabels: Record<string, string> = {
  'universities.read': 'Просмотр вузов',
  'universities.create': 'Добавление вузов',
  'universities.update': 'Изменение вузов',
  'university_contacts.read': 'Просмотр контактов',
  'university_contacts.create': 'Добавление контактов',
  'university_contacts.update': 'Изменение контактов',
  'catalogs.read': 'Просмотр каталогов',
  'catalogs.manage': 'Изменение каталогов',
  'catalogs.import': 'Импорт каталогов',
  'projects.read': 'Просмотр проектов',
  'projects.create': 'Создание проектов',
  'projects.update': 'Изменение проектов',
  'projects.stage.advance': 'Переход между этапами',
  'projects.workflow.configure': 'Настройка workflow',
  'projects.close': 'Закрытие проектов',
  'projects.comments.create': 'Добавление комментариев',
  'projects.comments.update': 'Редактирование комментариев',
  'projects.comments.delete': 'Удаление комментариев',
  'projects.files.manage': 'Прикрепление и завершение документов',
  'universities.assignees.manage': 'Назначение ответственных за вузы',
  'projects.assignees.manage': 'Назначение участников проектов',
  'permissions.manage': 'Управление правами',
  'visibility.manage': 'Управление видимостью КАМ',
  'dashboard.read': 'Просмотр главной',
  'reports.read': 'Просмотр отчётов',
  'reports.export': 'Выгрузка отчётов',
  'statistics.read': 'Просмотр и выгрузка статистики',
  'integrations.manage': 'Управление интеграциями',
  'integrations.sync': 'Запуск синхронизации',
};

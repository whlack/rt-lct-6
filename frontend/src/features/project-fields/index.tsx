import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  projectApi,
  type Project,
  type ProjectFields,
} from '../../entities/project';
import { employeeApi } from '../../entities/employee';
import { useSession } from '../../shared/session';
import { date, employeeName, formText, useAction } from '../../shared/lib';
import {
  ActionState,
  Field,
  Form,
  Modal,
  Panel,
  QueryState,
  Submit,
} from '../../shared/ui';
export const transferNames = {
  NOT_STARTED: 'Не начата',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершена',
};
export function ProjectFieldsPanel({ project }: { project: Project }) {
  const { can } = useSession();
  const [edit, setEdit] = useState(false);
  const action = useAction(
    (body: ProjectFields) => projectApi.update(project.id, body),
    ['projects', 'history', 'reports'],
  );
  return (
    <Panel>
      <div className="section-heading">
        <h2>Договор и лицензия</h2>
        {can('projects.update') && !project.closedAt && (
          <button
            className="button"
            onClick={() => {
              action.reset();
              setEdit(true);
            }}
          >
            Изменить
          </button>
        )}
      </div>
      <dl className="details-list">
        <dt>Вендор</dt>
        <dd>{project.vendor ?? '—'}</dd>
        <dt>Номер договора</dt>
        <dd>{project.contractNumber ?? '—'}</dd>
        <dt>Лицензия подписана</dt>
        <dd>{date(project.licenseSignedAt)}</dd>
        <dt>Срок лицензии (год)</dt>
        <dd>{project.licenseExpiresYear ?? '—'}</dd>
        <dt>Передача</dt>
        <dd>{transferNames[project.transferStatus]}</dd>
      </dl>
      {edit && (
        <Modal title="Договор и лицензия" onClose={() => setEdit(false)}>
          <Form
            onSubmit={(data) => {
              const status = formText(data, 'transferStatus');
              action.mutate(
                {
                  vendor: formText(data, 'vendor') || null,
                  contractNumber: formText(data, 'contractNumber') || null,
                  licenseSignedAt: formText(data, 'licenseSignedAt')
                    ? new Date(formText(data, 'licenseSignedAt')).toISOString()
                    : null,
                  licenseExpiresYear: formText(data, 'licenseExpiresYear')
                    ? Number(formText(data, 'licenseExpiresYear'))
                    : null,
                  transferStatus:
                    status === 'COMPLETED'
                      ? 'COMPLETED'
                      : status === 'IN_PROGRESS'
                        ? 'IN_PROGRESS'
                        : 'NOT_STARTED',
                },
                { onSuccess: () => setEdit(false) },
              );
            }}
          >
            <Field label="Вендор">
              <input
                name="vendor"
                maxLength={200}
                defaultValue={project.vendor ?? ''}
              />
            </Field>
            <Field label="Номер договора">
              <input
                name="contractNumber"
                maxLength={200}
                defaultValue={project.contractNumber ?? ''}
              />
            </Field>
            <Field label="Подписание лицензии">
              <input
                name="licenseSignedAt"
                type="date"
                defaultValue={project.licenseSignedAt?.slice(0, 10) ?? ''}
              />
            </Field>
            <Field label="Срок лицензии (год)">
              <input
                name="licenseExpiresYear"
                type="number"
                min={2000}
                max={2100}
                defaultValue={project.licenseExpiresYear ?? ''}
              />
            </Field>
            <Field label="Статус передачи">
              <select
                name="transferStatus"
                defaultValue={project.transferStatus}
              >
                {Object.entries(transferNames).map(([value, title]) => (
                  <option value={value} key={value}>
                    {title}
                  </option>
                ))}
              </select>
            </Field>
            <ActionState action={action} />
            <Submit pending={action.isPending} />
          </Form>
        </Modal>
      )}
    </Panel>
  );
}
export function ProjectAssignments({ project }: { project: Project }) {
  const { can, user } = useSession();
  const allowed = can('projects.assignees.manage') && !project.closedAt;
  const [employees, managers] = useQueries({
    queries: [
      {
        queryKey: ['employees'],
        queryFn: ({ signal }) => employeeApi.list(signal),
        enabled:
          allowed ||
          can('projects.create') ||
          can('universities.assignees.manage'),
      },
      {
        queryKey: ['managers'],
        queryFn: ({ signal }) => employeeApi.managers(signal),
        enabled: allowed,
      },
    ],
  });
  const action = useAction(
    (input: { role: 'responsible' | 'supervisor'; subject: string }) =>
      projectApi.assign(project.id, input.role, input.subject),
    ['projects', 'history', 'dashboard', 'reports'],
  );
  const responsible =
    employees.data?.find(
      (item) => item.subject === project.responsible.keycloakSubject,
    ) ??
    (user?.subject === project.responsible.keycloakSubject
      ? user
      : project.responsible);
  const supervisor =
    managers.data?.find(
      (item) => item.subject === project.supervisor?.keycloakSubject,
    ) ?? project.supervisor;
  return (
    <Panel>
      <h2>Участники</h2>
      <dl className="details-list">
        <dt>КАМ</dt>
        <dd>{employeeName(responsible)}</dd>
        <dt>Руководитель</dt>
        <dd>{employeeName(supervisor)}</dd>
      </dl>
      {allowed && (
        <>
          <QueryState query={employees} />
          <QueryState query={managers} />
          <Form
            onSubmit={(data) =>
              action.mutate({
                role: 'responsible',
                subject: formText(data, 'subject'),
              })
            }
          >
            <Field label="Назначить ответственного КАМ">
              <select
                name="subject"
                required
                defaultValue={project.responsible.keycloakSubject}
              >
                {employees.data?.map((item) => (
                  <option key={item.subject} value={item.subject}>
                    {employeeName(item)}
                  </option>
                ))}
              </select>
            </Field>
            <Submit pending={action.isPending}>Назначить КАМ</Submit>
          </Form>
          <Form
            onSubmit={(data) =>
              action.mutate({
                role: 'supervisor',
                subject: formText(data, 'subject'),
              })
            }
          >
            <Field label="Назначить руководителя">
              <select
                name="subject"
                required
                defaultValue={project.supervisor?.keycloakSubject ?? ''}
              >
                <option value="" disabled>
                  Выберите руководителя
                </option>
                {managers.data?.map((item) => (
                  <option key={item.subject} value={item.subject}>
                    {employeeName(item)}
                  </option>
                ))}
              </select>
            </Field>
            <Submit pending={action.isPending}>Назначить руководителя</Submit>
          </Form>
          <ActionState action={action} />
        </>
      )}
    </Panel>
  );
}

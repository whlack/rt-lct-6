import { useQueries } from '@tanstack/react-query';
import { universityApi } from '../../entities/university';
import { employeeApi } from '../../entities/employee';
import { employeeName, useAction, formText } from '../../shared/lib';
import {
  ActionState,
  Empty,
  Field,
  Form,
  Panel,
  QueryState,
  Submit,
} from '../../shared/ui';
export function UniversityAssignees({ id }: { id: string }) {
  const [assignees, employees] = useQueries({
    queries: [
      {
        queryKey: ['assignees', id],
        queryFn: ({ signal }) => universityApi.assignees(id, signal),
      },
      {
        queryKey: ['employees'],
        queryFn: ({ signal }) => employeeApi.list(signal),
      },
    ],
  });
  const assign = useAction(
    (subject: string) => universityApi.assign(id, subject),
    ['assignees', 'universities', 'session'],
  );
  const remove = useAction(
    (subject: string) => universityApi.unassign(id, subject),
    ['assignees', 'universities', 'session'],
  );
  return (
    <Panel>
      <h2>Ответственные КАМ</h2>
      <QueryState query={assignees} />
      <QueryState query={employees} />
      {assignees.data &&
        (!assignees.data.length ? (
          <Empty />
        ) : (
          <div className="list-stack">
            {assignees.data.map((item) => (
              <div className="list-row" key={item.userId}>
                <span>
                  {item.user.displayName ||
                    item.user.email ||
                    'Сотрудник без профиля'}
                </span>
                <button
                  className="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.user.keycloakSubject)}
                >
                  Снять назначение
                </button>
              </div>
            ))}
          </div>
        ))}
      <Form onSubmit={(data) => assign.mutate(formText(data, 'subject'))}>
        <Field label="Назначить КАМ">
          <select name="subject" required defaultValue="">
            <option value="" disabled>
              Выберите сотрудника
            </option>
            {employees.data
              ?.filter(
                (person) =>
                  !assignees.data?.some(
                    (item) => item.user.keycloakSubject === person.subject,
                  ),
              )
              .map((person) => (
                <option key={person.subject} value={person.subject}>
                  {employeeName(person)}
                </option>
              ))}
          </select>
        </Field>
        <Submit pending={assign.isPending}>Назначить</Submit>
        <ActionState action={assign} />
        <ActionState action={remove} />
      </Form>
    </Panel>
  );
}

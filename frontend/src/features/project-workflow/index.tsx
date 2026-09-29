import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  projectApi,
  type Project,
  type WorkflowInput,
} from '../../entities/project';
import { universityApi } from '../../entities/university';
import { useSession } from '../../shared/session';
import { useAction } from '../../shared/lib';
import {
  ActionState,
  Badge,
  Field,
  Modal,
  Panel,
  QueryState,
} from '../../shared/ui';
import { canConfigure, missingDocuments, validateWorkflow } from './model';
export { canConfigure, missingDocuments, validateWorkflow } from './model';
export function ProjectWorkflow({ project }: { project: Project }) {
  const { can, user } = useSession();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'advance' | 'close'>();
  const current = project.stages.find(
    (stage) => stage.position === project.currentStageIndex,
  );
  const last = current?.position === project.stages.length - 1;
  const missing = missingDocuments(project);
  const transition = useAction(
    (operation: 'advance' | 'close') =>
      operation === 'close'
        ? projectApi.close(project.id)
        : projectApi.advance(project.id, current!.id),
    ['projects', 'history', 'dashboard', 'activity', 'reports', 'statistics'],
  );
  return (
    <Panel>
      <div className="section-heading">
        <h2>Маршрут проекта</h2>
        {can('projects.workflow.configure') &&
          canConfigure(project, user?.level ?? 0) && (
            <button className="button" onClick={() => setEditing(true)}>
              Настроить этапы
            </button>
          )}
      </div>
      <ol className="stage-route">
        {project.stages.map((stage) => (
          <li
            key={stage.id}
            className={
              stage.position === project.currentStageIndex
                ? 'current'
                : stage.position < project.currentStageIndex
                  ? 'done'
                  : ''
            }
          >
            <span>{stage.position + 1}</span>
            <div>
              <strong>{stage.title}</strong>
              <small>
                {stage.expectedActor === 'KAM'
                  ? 'Ожидается действие КАМ'
                  : `Ожидается действие вуза${stage.expectedContact ? ': ' + stage.expectedContact.name : ''}`}
              </small>
            </div>
            {stage.position === project.currentStageIndex && (
              <Badge>Текущий</Badge>
            )}
          </li>
        ))}
      </ol>
      {!project.closedAt && current && (
        <div className="stage-control">
          <div>
            <small>Следующее действие</small>
            <strong>
              {current.expectedActor === 'KAM'
                ? 'Действие ответственного КАМ'
                : 'Действие контакта вуза'}{' '}
              · {current.title}
            </strong>
            {missing.length > 0 && (
              <p className="error-message">
                Для перехода приложите: {missing.join(', ')}.
              </p>
            )}
          </div>
          {last
            ? can('projects.close') &&
              (user?.level ?? 0) >= 20 && (
                <button
                  className="button button-primary"
                  disabled={missing.length > 0 || transition.isPending}
                  onClick={() => setConfirm('close')}
                >
                  Закрыть проект
                </button>
              )
            : can('projects.stage.advance') && (
                <button
                  className="button button-primary"
                  disabled={missing.length > 0 || transition.isPending}
                  onClick={() => setConfirm('advance')}
                >
                  Следующий этап →
                </button>
              )}
        </div>
      )}
      <ActionState action={transition} />
      {confirm && (
        <Modal
          title={
            confirm === 'close'
              ? 'Закрыть проект?'
              : 'Перейти на следующий этап?'
          }
          onClose={() => setConfirm(undefined)}
        >
          <p>
            {confirm === 'close'
              ? 'Проект будет завершён. Редактирование станет недоступно.'
              : project.currentStageIndex === 0
                ? 'После перехода состав и порядок этапов будут зафиксированы.'
                : 'Переход будет записан в историю проекта.'}
          </p>
          <button
            className="button button-primary"
            disabled={transition.isPending}
            onClick={() =>
              transition.mutate(confirm, {
                onSuccess: () => setConfirm(undefined),
              })
            }
          >
            Подтвердить
          </button>
          <ActionState action={transition} />
        </Modal>
      )}
      {editing && (
        <WorkflowEditor project={project} onClose={() => setEditing(false)} />
      )}
    </Panel>
  );
}
function WorkflowEditor({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { can } = useSession();
  const [stages, setStages] = useState(() =>
    project.stages
      .filter((stage) => stage.position > 0)
      .map((stage) => ({
        key: stage.id,
        title: stage.title,
        expectedActor: stage.expectedActor,
        expectedContactId: stage.expectedContactId ?? undefined,
        documentTypes: stage.documentTypes.map((type) => ({
          key: type.id,
          name: type.name,
          isRequired: type.isRequired,
        })),
      })),
  );
  const [validation, setValidation] = useState('');
  const contacts = useQuery({
    queryKey: ['contacts', project.universityId],
    queryFn: ({ signal }) =>
      universityApi.contacts(project.universityId, signal),
    enabled: can('university_contacts.read'),
  });
  const save = useAction(
    (body: WorkflowInput[]) => projectApi.workflow(project.id, body),
    ['projects', 'history', 'activity'],
  );
  function patch(index: number, changes: Partial<(typeof stages)[number]>) {
    setStages((current) =>
      current.map((stage, position) =>
        position === index ? { ...stage, ...changes } : stage,
      ),
    );
  }
  function move(index: number, offset: number) {
    setStages((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }
  return (
    <Modal title="Настройка workflow проекта" onClose={onClose}>
      <p className="muted">
        Первый этап «Формирование проекта» системный. Настраиваются только
        следующие этапы.
      </p>
      {can('university_contacts.read') && <QueryState query={contacts} />}
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const body = stages.map((stage) => ({
            title: stage.title.trim(),
            expectedActor: stage.expectedActor,
            ...(stage.expectedActor === 'UNIVERSITY'
              ? { expectedContactId: stage.expectedContactId }
              : {}),
            documentTypes: stage.documentTypes.map((type) => ({
              name: type.name.trim(),
              isRequired: type.isRequired,
            })),
          }));
          const error = validateWorkflow(body);
          setValidation(error);
          if (!error) save.mutate(body, { onSuccess: onClose });
        }}
      >
        {stages.map((stage, index) => (
          <fieldset key={stage.key} className="workflow-editor-stage">
            <legend>Этап {index + 2}</legend>
            <div className="flex gap-2 justify-end">
              <button
                className="button"
                type="button"
                disabled={index === 0 || save.isPending}
                onClick={() => move(index, -1)}
                aria-label={`Поднять этап ${index + 2}`}
              >
                ↑
              </button>
              <button
                className="button"
                type="button"
                disabled={index === stages.length - 1 || save.isPending}
                onClick={() => move(index, 1)}
                aria-label={`Опустить этап ${index + 2}`}
              >
                ↓
              </button>
              <button
                className="button"
                type="button"
                disabled={stages.length <= 1 || save.isPending}
                onClick={() =>
                  setStages((current) =>
                    current.filter((item) => item.key !== stage.key),
                  )
                }
              >
                Удалить этап
              </button>
            </div>
            <Field label="Название этапа">
              <input
                value={stage.title}
                required
                maxLength={200}
                onChange={(event) =>
                  patch(index, { title: event.target.value })
                }
              />
            </Field>
            <Field label="Ожидаемая сторона">
              <select
                value={stage.expectedActor}
                onChange={(event) =>
                  patch(index, {
                    expectedActor:
                      event.target.value === 'KAM' ? 'KAM' : 'UNIVERSITY',
                    expectedContactId: undefined,
                  })
                }
              >
                <option value="KAM">КАМ</option>
                <option
                  value="UNIVERSITY"
                  disabled={!can('university_contacts.read')}
                >
                  Вуз
                </option>
              </select>
            </Field>
            {stage.expectedActor === 'UNIVERSITY' && (
              <Field label="Контакт вуза">
                <select
                  required
                  value={stage.expectedContactId ?? ''}
                  onChange={(event) =>
                    patch(index, { expectedContactId: event.target.value })
                  }
                >
                  <option value="" disabled>
                    Выберите контакт
                  </option>
                  {contacts.data?.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <h3>Документы этапа</h3>
            {stage.documentTypes.map((type, typeIndex) => (
              <div className="document-type-editor" key={type.key}>
                <Field label="Название документа">
                  <input
                    value={type.name}
                    required
                    maxLength={160}
                    onChange={(event) =>
                      patch(index, {
                        documentTypes: stage.documentTypes.map(
                          (item, position) =>
                            position === typeIndex
                              ? { ...item, name: event.target.value }
                              : item,
                        ),
                      })
                    }
                  />
                </Field>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={type.isRequired}
                    onChange={(event) =>
                      patch(index, {
                        documentTypes: stage.documentTypes.map(
                          (item, position) =>
                            position === typeIndex
                              ? { ...item, isRequired: event.target.checked }
                              : item,
                        ),
                      })
                    }
                  />
                  Обязательный
                </label>
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    patch(index, {
                      documentTypes: stage.documentTypes.filter(
                        (item) => item.key !== type.key,
                      ),
                    })
                  }
                >
                  Убрать документ
                </button>
              </div>
            ))}
            <button
              className="button"
              type="button"
              disabled={stage.documentTypes.length >= 30 || save.isPending}
              onClick={() =>
                patch(index, {
                  documentTypes: [
                    ...stage.documentTypes,
                    { key: crypto.randomUUID(), name: '', isRequired: false },
                  ],
                })
              }
            >
              + Тип документа
            </button>
          </fieldset>
        ))}
        <button
          className="button"
          type="button"
          disabled={stages.length >= 20 || save.isPending}
          onClick={() =>
            setStages((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                title: '',
                expectedActor: 'KAM',
                expectedContactId: undefined,
                documentTypes: [],
              },
            ])
          }
        >
          + Этап
        </button>
        {validation && (
          <p role="alert" className="error-message">
            {validation}
          </p>
        )}
        <ActionState action={save} />
        <button
          className="button button-primary"
          disabled={save.isPending}
          type="submit"
        >
          Сохранить workflow
        </button>
      </form>
    </Modal>
  );
}

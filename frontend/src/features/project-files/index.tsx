import { projectApi, type Project } from '../../entities/project';
import { useSession } from '../../shared/session';
import { useAction } from '../../shared/lib';
import {
  ActionState,
  Badge,
  Empty,
  Field,
  Form,
  Panel,
  Submit,
} from '../../shared/ui';
export function ProjectFiles({ project }: { project: Project }) {
  const { can } = useSession();
  const download = useAction((id: string) =>
    projectApi.download(project.id, id),
  );
  const complete = useAction(
    (id: string) => projectApi.complete(project.id, id),
    ['projects', 'history', 'activity'],
  );
  const upload = useAction(
    async (input: { stageId: string; typeId: string; file: File }) => {
      if (!input.file.size || input.file.size > 25 * 1024 * 1024)
        throw new Error('Выберите непустой файл размером до 25 МБ.');
      return projectApi.upload(
        project.id,
        input.stageId,
        input.typeId,
        input.file,
      );
    },
    ['projects', 'history', 'activity'],
  );
  return (
    <Panel>
      <h2>Документы</h2>
      <p className="muted">
        Файлы прикрепляются к типу документа текущего этапа. Отсутствие
        обязательного документа блокирует переход.
      </p>
      {project.stages
        .filter((stage) => stage.documentTypes.length || stage.files.length)
        .map((stage) => (
          <section className="document-stage" key={stage.id}>
            <h3>{stage.title}</h3>
            {stage.documentTypes.map((type) => (
              <div className="document-type" key={type.id}>
                <div className="flex gap-2 items-center">
                  <strong>{type.name}</strong>
                  {type.isRequired && <Badge>Обязательный</Badge>}
                </div>
                {stage.files
                  .filter((file) => file.documentTypeId === type.id)
                  .map((file) => (
                    <div className="list-row" key={file.id}>
                      <div>
                        <strong>{file.fileName}</strong>
                        <small>
                          {Math.ceil(file.size / 1024)} КБ ·{' '}
                          {file.status === 'COMPLETED'
                            ? 'Завершён'
                            : 'Прикреплён'}
                        </small>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="button"
                          disabled={download.isPending}
                          onClick={() => download.mutate(file.id)}
                        >
                          Скачать
                        </button>
                        {can('projects.files.manage') &&
                          !project.closedAt &&
                          stage.position === project.currentStageIndex &&
                          file.status !== 'COMPLETED' && (
                            <button
                              className="button"
                              disabled={complete.isPending}
                              onClick={() => complete.mutate(file.id)}
                            >
                              Отметить завершённым
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                {!stage.files.some(
                  (file) => file.documentTypeId === type.id,
                ) && <Empty>Файл не прикреплён.</Empty>}
                {can('projects.files.manage') &&
                  !project.closedAt &&
                  stage.position === project.currentStageIndex && (
                    <Form
                      onSubmit={(data, form) => {
                        const file = data.get('file');
                        if (file instanceof File)
                          upload.mutate(
                            { file, stageId: stage.id, typeId: type.id },
                            { onSuccess: () => form.reset() },
                          );
                      }}
                    >
                      <Field label={`Файл: ${type.name}`}>
                        <input
                          type="file"
                          name="file"
                          required
                          accept=".png,.jpg,.jpeg,.pdf,.zip,.gz,.rar,.doc,.docx,.xls,.xlsx"
                        />
                      </Field>
                      <Submit pending={upload.isPending}>Прикрепить</Submit>
                    </Form>
                  )}
              </div>
            ))}
          </section>
        ))}
      {!project.stages.some((stage) => stage.documentTypes.length) && (
        <Empty>Типы документов пока не заданы в workflow.</Empty>
      )}
      <ActionState action={upload} />
      <ActionState action={complete} />
      <ActionState action={download} />
    </Panel>
  );
}

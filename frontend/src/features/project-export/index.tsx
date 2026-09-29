import { useState } from 'react';
import { reportApi, type ReportFormat } from '../../entities/report';
import { useJobs } from '../../entities/job';
import { useAction } from '../../shared/lib';
import { ActionState, Field, Modal } from '../../shared/ui';
export function ProjectExport({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const { add } = useJobs();
  const action = useAction(() => reportApi.export({ projectId: id, format }));
  return (
    <>
      <button
        className="button"
        onClick={() => {
          action.reset();
          setOpen(true);
        }}
      >
        Отчёт проекта
      </button>
      {open && (
        <Modal title="Выгрузка отчёта проекта" onClose={() => setOpen(false)}>
          <p>
            Полный отчёт включает события и документы проекта без ограничения
            периода.
          </p>
          <Field label="Формат">
            <select
              value={format}
              onChange={(event) => {
                const value = event.target.value;
                setFormat(
                  value === 'json' || value === 'xls' || value === 'xlsx'
                    ? value
                    : 'pdf',
                );
              }}
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">XLSX</option>
              <option value="xls">XLS</option>
              <option value="json">JSON</option>
            </select>
          </Field>
          <button
            className="button button-primary"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(undefined, {
                onSuccess: (result) => {
                  add(result.id, title);
                  setOpen(false);
                },
              })
            }
          >
            Подготовить файл
          </button>
          <ActionState action={action} />
        </Modal>
      )}
    </>
  );
}

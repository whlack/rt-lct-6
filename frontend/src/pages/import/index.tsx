import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { jobApi, jobNames, shouldPoll } from '../../entities/job';
import { useAction } from '../../shared/lib';
import {
  ActionState,
  Empty,
  Field,
  Form,
  Modal,
  PageHeader,
  Panel,
  Pagination,
  QueryState,
  Submit,
} from '../../shared/ui';
export function ImportPage() {
  const [params, setParams] = useSearchParams();
  const id = params.get('import') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [confirm, setConfirm] = useState(false);
  const upload = useAction(async (file: File) => {
    if (
      !file.size ||
      file.size > 10 * 1024 * 1024 ||
      !/\.xlsx?$/i.test(file.name)
    )
      throw new Error('Выберите непустой XLS/XLSX до 10 МБ.');
    return jobApi.upload(file);
  });
  const query = useQuery({
    queryKey: ['imports', id, page],
    queryFn: ({ signal }) => jobApi.import(id, page, signal),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.error
        ? false
        : shouldPoll(query.state.data?.status)
          ? 2000
          : false,
  });
  const apply = useAction(
    () => jobApi.apply(id),
    [
      'imports',
      'jobs',
      'universities',
      'catalogs',
      'employees',
      'projects',
      'dashboard',
    ],
  );
  const download = useAction(() => jobApi.download(id));
  return (
    <>
      <PageHeader
        title="Импорт каталогов"
        subtitle="Проверка файла, предпросмотр и подтверждение изменений"
      />
      <Panel>
        <h2>1. Выберите файл</h2>
        <p className="muted">
          Используйте согласованный шаблон XLS/XLSX. Листы: вузы, направления,
          программы и продукты, сотрудники. Изменения применяются только после
          проверки и вашего подтверждения.
        </p>
        <a className="button" href="/templates/catalog-import.xlsx" download>
          Скачать шаблон XLSX
        </a>
        <Form
          onSubmit={(data) => {
            const file = data.get('file');
            if (file instanceof File)
              upload.mutate(file, {
                onSuccess: (result) => {
                  setParams({ import: result.id });
                  apply.reset();
                  download.reset();
                },
              });
          }}
        >
          <Field label="Файл до 10 МБ">
            <input name="file" required type="file" accept=".xls,.xlsx" />
          </Field>
          <Submit pending={upload.isPending}>Проверить файл</Submit>
          <ActionState action={upload} />
        </Form>
      </Panel>
      {id && (
        <Panel>
          <h2>2. Проверка и результат</h2>
          <QueryState query={query} />
          {query.data && (
            <>
              <p role="status">
                {jobNames[query.data.status]} · {query.data.progress}%
              </p>
              {query.data.counts && (
                <div className="import-counts">
                  {Object.entries(query.data.counts).map(([key, value]) => (
                    <span className="badge" key={key}>
                      {countNames[key] ?? key}: {value}
                    </span>
                  ))}
                </div>
              )}
              {query.data.status === 'FAILED' && (
                <p className="error-message">
                  Импорт завершился ошибкой. Проверьте файл и запустите проверку
                  заново.
                </p>
              )}
              {query.data.rows.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Лист / строка</th>
                        <th>Данные</th>
                        <th>Действие</th>
                        <th>Результат</th>
                        <th>Ошибки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {row.sheet} · {row.rowNumber}
                          </td>
                          <td>
                            {Object.entries(row.data).map(([key, value]) => (
                              <div key={key}>
                                <small>{key}</small>: {String(value)}
                              </div>
                            ))}
                          </td>
                          <td>{countNames[row.action] ?? row.action}</td>
                          <td>{countNames[row.result] ?? row.result}</td>
                          <td>
                            {row.errors.map((error, index) => (
                              <p className="error-message" key={index}>
                                {error.column}: {error.message}
                              </p>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>Строки появятся после проверки.</Empty>
              )}
              <Pagination
                page={page}
                total={query.data.total}
                size={25}
                onChange={(value) =>
                  setParams({ import: id, page: String(value) })
                }
              />
              <div className="flex flex-wrap gap-2">
                {query.data.status === 'PREVIEW' && (
                  <button
                    className="button button-primary"
                    disabled={apply.isPending}
                    onClick={() => setConfirm(true)}
                  >
                    Применить допустимые строки
                  </button>
                )}
                {(query.data.status === 'PREVIEW' ||
                  query.data.status === 'SUCCEEDED') && (
                  <button
                    className="button"
                    disabled={download.isPending}
                    onClick={() => download.mutate(undefined)}
                  >
                    Скачать файл ошибок
                  </button>
                )}
              </div>
              <ActionState action={apply} />
              <ActionState action={download} />
              {query.data.status === 'SUCCEEDED' && (
                <p className="success-message">
                  Изменения подтверждены сервером. Ошибочные строки не
                  применялись.
                </p>
              )}
            </>
          )}
        </Panel>
      )}
      {confirm && (
        <Modal title="Применить импорт?" onClose={() => setConfirm(false)}>
          <p>
            Допустимые строки будут повторно проверены и записаны в каталоги.
            Строки с ошибками будут пропущены.
          </p>
          <button
            className="button button-primary"
            disabled={apply.isPending}
            onClick={() =>
              apply.mutate(undefined, { onSuccess: () => setConfirm(false) })
            }
          >
            Подтвердить применение
          </button>
          <ActionState action={apply} />
        </Modal>
      )}
    </>
  );
}
const countNames: Record<string, string> = {
  total: 'Всего',
  CREATE: 'Добавить',
  UPDATE: 'Обновить',
  SKIP: 'Пропустить',
  ERROR: 'Ошибки',
  CREATED: 'Добавлено',
  UPDATED: 'Обновлено',
  SKIPPED: 'Пропущено',
  PENDING: 'Ожидает',
};

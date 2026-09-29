import { useState, type ReactNode } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  reportApi,
  columns,
  templates,
  validateReportFilters,
  type ReportColumn,
  type ReportFilters,
  type ReportFormat,
  type ReportRow,
} from '../../entities/report';
import { universityApi } from '../../entities/university';
import { catalogApi } from '../../entities/catalog';
import { employeeApi } from '../../entities/employee';
import { useJobs } from '../../entities/job';
import { useSession } from '../../features/session';
import { StatisticsCharts } from '../../widgets/statistics';
import {
  ActionState,
  Empty,
  Field,
  Form,
  PageHeader,
  Panel,
  Pagination,
  QueryState,
} from '../../shared/ui';
import { date, employeeName, formText, useAction } from '../../shared/lib';
function readFilters(params: URLSearchParams): ReportFilters {
  return Object.fromEntries(
    [
      'dateFrom',
      'dateTo',
      'universityId',
      'directionId',
      'programId',
      'productId',
      'responsibleSubject',
      'status',
    ].flatMap((key) => (params.get(key) ? [[key, params.get(key)!]] : [])),
  );
}
export function ReportsPage() {
  const { can } = useSession();
  const { add } = useJobs();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const requestedView = params.get('view') ?? 'catalog';
  const view = !can('reports.read')
    ? 'statistics'
    : requestedView === 'statistics' && can('statistics.read')
      ? 'statistics'
      : requestedView === 'builder'
        ? 'builder'
        : 'catalog';
  const [selected, setSelected] = useState<ReportColumn[]>([
    ...templates[0].columns,
  ]);
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [validation, setValidation] = useState('');
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filterError = validateReportFilters(filters);
  const report = useQuery({
    queryKey: ['reports', filters, page],
    queryFn: ({ signal }) => reportApi.list(filters, page, signal),
    enabled: view === 'builder' && !filterError && can('reports.read'),
  });
  const [universities, directions, programs, products, employees] = useQueries({
    queries: [
      {
        queryKey: ['universities'],
        queryFn: ({ signal }) => universityApi.list(signal),
        enabled: can('universities.read'),
      },
      {
        queryKey: ['catalogs', 'directions'],
        queryFn: ({ signal }) => catalogApi.list('directions', signal),
        enabled: can('catalogs.read'),
      },
      {
        queryKey: ['catalogs', 'programs'],
        queryFn: ({ signal }) => catalogApi.list('programs', signal),
        enabled: can('catalogs.read'),
      },
      {
        queryKey: ['catalogs', 'products'],
        queryFn: ({ signal }) => catalogApi.list('products', signal),
        enabled: can('catalogs.read'),
      },
      {
        queryKey: ['employees'],
        queryFn: ({ signal }) => employeeApi.list(signal),
        enabled: can('projects.create') || can('universities.assignees.manage'),
      },
    ],
  });
  const exportReport = useAction(() =>
    reportApi.export({ ...filters, columns: selected, format }),
  );
  function selectView(next: string) {
    setParams((previous) => {
      const copy = new URLSearchParams(previous);
      copy.set('view', next);
      copy.delete('page');
      return copy;
    });
  }
  return (
    <>
      <PageHeader
        title="Отчёты"
        subtitle="Сводки, проектные данные и статистика"
      />
      <div className="reports-toolbar">
        <div className="reports-view-switch">
          {can('reports.read') && (
            <>
              <button
                aria-pressed={view === 'catalog'}
                onClick={() => selectView('catalog')}
              >
                Каталог
              </button>
              <button
                aria-pressed={view === 'builder'}
                onClick={() => selectView('builder')}
              >
                Конструктор
              </button>
            </>
          )}
          {can('statistics.read') && (
            <button
              aria-pressed={view === 'statistics'}
              onClick={() => selectView('statistics')}
            >
              Статистика
            </button>
          )}
        </div>
      </div>
      {view === 'catalog' ? (
        <div className="reports-catalog">
          {templates.map((template) => (
            <button
              className="report-template-card"
              key={template.title}
              onClick={() => {
                setSelected([...template.columns]);
                selectView('builder');
              }}
            >
              <h2>{template.title}</h2>
              <p>{template.description}</p>
              <span className="text-link">Открыть отчёт →</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <Panel>
            <h2>Выборка</h2>
            <Form
              key={params.toString()}
              onSubmit={(data) => {
                const body: ReportFilters = Object.fromEntries(
                  [
                    'dateFrom',
                    'dateTo',
                    'universityId',
                    'directionId',
                    'programId',
                    'productId',
                    'responsibleSubject',
                    'status',
                  ].flatMap((key) =>
                    formText(data, key) ? [[key, formText(data, key)]] : [],
                  ),
                );
                const error = validateReportFilters(body);
                setValidation(error);
                if (!error)
                  setParams({ ...body, view } as Record<string, string>);
              }}
            >
              <div className="filter-grid">
                <Field label="Начало периода">
                  <input
                    type="date"
                    name="dateFrom"
                    defaultValue={filters.dateFrom}
                  />
                </Field>
                <Field label="Окончание периода">
                  <input
                    type="date"
                    name="dateTo"
                    defaultValue={filters.dateTo}
                  />
                </Field>
                <Field label="Статус">
                  <select name="status" defaultValue={filters.status ?? ''}>
                    <option value="">Все статусы</option>
                    <option value="ACTIVE">Активные</option>
                    <option value="CLOSED">Закрытые</option>
                  </select>
                </Field>
                {can('universities.read') && (
                  <Field label="Вуз">
                    <select
                      name="universityId"
                      defaultValue={filters.universityId ?? ''}
                    >
                      <option value="">Все вузы</option>
                      {universities.data?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {can('catalogs.read') && (
                  <>
                    <Field label="Направление">
                      <select
                        name="directionId"
                        defaultValue={filters.directionId ?? ''}
                      >
                        <option value="">Все направления</option>
                        {directions.data?.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Программа">
                      <select
                        name="programId"
                        defaultValue={filters.programId ?? ''}
                      >
                        <option value="">Все программы</option>
                        {programs.data?.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Продукт">
                      <select
                        name="productId"
                        defaultValue={filters.productId ?? ''}
                      >
                        <option value="">Все продукты</option>
                        {products.data?.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
                {employees.data && (
                  <Field label="Ответственный КАМ">
                    <select
                      name="responsibleSubject"
                      defaultValue={filters.responsibleSubject ?? ''}
                    >
                      <option value="">Все КАМ</option>
                      {employees.data.map((item) => (
                        <option key={item.subject} value={item.subject}>
                          {employeeName(item)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              {[universities, directions, programs, products, employees]
                .filter((query) => query.isError)
                .map((query, index) => (
                  <QueryState key={index} query={query} />
                ))}
              <div className="flex gap-2">
                <button className="button button-primary" type="submit">
                  Применить фильтры
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setValidation('');
                    setParams({ view });
                  }}
                >
                  Сбросить
                </button>
              </div>
              {(validation || filterError) && (
                <p className="error-message" role="alert">
                  {validation || filterError}
                </p>
              )}
            </Form>
          </Panel>
          {view === 'statistics' ? (
            can('statistics.read') &&
            !filterError && <StatisticsCharts filters={filters} />
          ) : (
            <>
              <Panel>
                <h2>Колонки отчёта</h2>
                <div className="columns-grid">
                  {columns.map(([key, title]) => (
                    <label className="checkbox-label" key={key}>
                      <input
                        type="checkbox"
                        checked={selected.includes(key)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, key]
                              : current.filter((item) => item !== key),
                          )
                        }
                      />
                      {title}
                    </label>
                  ))}
                </div>
                <div className="export-toolbar">
                  <Field label="Формат">
                    <select
                      value={format}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFormat(
                          value === 'pdf' || value === 'json' || value === 'xls'
                            ? value
                            : 'xlsx',
                        );
                      }}
                    >
                      <option value="xlsx">XLSX</option>
                      <option value="xls">XLS</option>
                      <option value="pdf">PDF</option>
                      <option value="json">JSON</option>
                    </select>
                  </Field>
                  {can('reports.export') && (
                    <button
                      className="button button-primary"
                      disabled={
                        exportReport.isPending ||
                        !selected.length ||
                        Boolean(filterError)
                      }
                      onClick={() =>
                        exportReport.mutate(undefined, {
                          onSuccess: (job) => {
                            add(job.id, 'Отчёт · ' + format.toUpperCase());
                            setParams((previous) => {
                              const copy = new URLSearchParams(previous);
                              copy.set('job', job.id);
                              return copy;
                            });
                          },
                        })
                      }
                    >
                      Сформировать файл
                    </button>
                  )}
                </div>
                <ActionState action={exportReport} />
              </Panel>
              <Panel>
                <h2>Предпросмотр</h2>
                {!filterError && <QueryState query={report} />}{' '}
                {report.data && (
                  <>
                    {report.data.rows.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Проект</th>
                              {selected.map((key) => (
                                <th key={key}>
                                  {columns.find(([id]) => id === key)?.[1]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {report.data.rows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <Link
                                    className="text-link"
                                    to={`/projects/${row.id}`}
                                  >
                                    {row.offering.name}
                                  </Link>
                                </td>
                                {selected.map((key) => (
                                  <td key={key}>{cell(row, key)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty />
                    )}
                    <Pagination
                      page={page}
                      total={report.data.total}
                      size={25}
                      onChange={(value) =>
                        setParams((previous) => {
                          const copy = new URLSearchParams(previous);
                          copy.set('page', String(value));
                          return copy;
                        })
                      }
                    />
                  </>
                )}
              </Panel>
            </>
          )}
        </>
      )}
    </>
  );
}
function cell(row: ReportRow, key: ReportColumn): ReactNode {
  const cells: Record<ReportColumn, ReactNode> = {
    id: row.id,
    university: row.university.name,
    direction: row.direction.name,
    offeringType: row.offering.type === 'PROGRAM' ? 'Программа' : 'Продукт',
    offering: row.offering.name,
    status: row.status === 'ACTIVE' ? 'Активен' : 'Закрыт',
    stage: row.currentStage?.title ?? '—',
    responsible: employeeName(row.responsible),
    supervisor: employeeName(row.supervisor),
    createdAt: date(row.createdAt),
    closedAt: date(row.closedAt),
    vendor: row.vendor ?? '—',
    contractNumber: row.contractNumber ?? '—',
    licenseSignedAt: date(row.licenseSignedAt),
    licenseExpiresYear: row.licenseExpiresYear ?? '—',
    transferStatus:
      row.transferStatus === 'COMPLETED'
        ? 'Завершена'
        : row.transferStatus === 'IN_PROGRESS'
          ? 'В процессе'
          : 'Не начата',
  };
  return cells[key];
}

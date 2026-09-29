import { useQuery } from '@tanstack/react-query';
import { reportApi, type ReportFilters } from '../../entities/report';
import { useJobs } from '../../entities/job';
import { useAction } from '../../shared/lib';
import { ActionState, Empty, Panel, QueryState } from '../../shared/ui';
export function StatisticsCharts({ filters }: { filters: ReportFilters }) {
  const { add } = useJobs();
  const query = useQuery({
    queryKey: ['statistics', filters],
    queryFn: ({ signal }) => reportApi.statistics(filters, signal),
  });
  const exportChart = useAction((format: 'png' | 'pdf') =>
    reportApi.chart(filters, format),
  );
  return (
    <>
      <Panel>
        <div className="section-heading">
          <h2>Статистика проектов</h2>
          <div className="flex gap-2">
            {(['png', 'pdf'] as const).map((format) => (
              <button
                className="button"
                key={format}
                disabled={exportChart.isPending}
                onClick={() =>
                  exportChart.mutate(format, {
                    onSuccess: (result) =>
                      add(result.id, 'Статистика · ' + format.toUpperCase()),
                  })
                }
              >
                Скачать {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <QueryState query={query} />
        <ActionState action={exportChart} />
        {query.data && (
          <>
            <div className="stats-summary">
              <div>
                <span>Активные</span>
                <strong>{query.data.status.active}</strong>
              </div>
              <div>
                <span>Закрытые</span>
                <strong>{query.data.status.closed}</strong>
              </div>
            </div>
            <h3>Распределение по направлениям</h3>
            {query.data.directions.length ? (
              <ul className="chart-bars">
                {query.data.directions.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <div>
                      <i
                        style={{
                          width: `${(100 * item.count) / Math.max(1, ...query.data!.directions.map((row) => row.count))}%`,
                        }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
            <h3>Создание и закрытие по месяцам</h3>
            <p className="muted">
              Период учитывается в часовом поясе {query.data.timezone}.
            </p>
            <div className="month-legend">
              <span>Создано</span>
              <span>Закрыто</span>
            </div>
            <div
              className="month-chart"
              role="img"
              aria-label="Создание и закрытие проектов по месяцам"
            >
              <div className="month-bars">
                {query.data.months.map((item) => (
                  <div key={item.month}>
                    <div className="month-values">
                      <i
                        title={`Создано: ${item.created}`}
                        style={{
                          height: `${(100 * item.created) / Math.max(1, ...query.data!.months.flatMap((row) => [row.created, row.closed]))}%`,
                        }}
                      />
                      <i
                        title={`Закрыто: ${item.closed}`}
                        style={{
                          height: `${(100 * item.closed) / Math.max(1, ...query.data!.months.flatMap((row) => [row.created, row.closed]))}%`,
                        }}
                      />
                    </div>
                    <small>{item.month}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <caption>Данные месячного графика</caption>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>Создано</th>
                    <th>Закрыто</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.months.map((item) => (
                    <tr key={item.month}>
                      <td>{item.month}</td>
                      <td>{item.created}</td>
                      <td>{item.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { integrationApi, type Integration } from '../../entities/integration';
import { useSession } from '../../features/session';
import { useAction, date } from '../../shared/lib';
import {
  ActionState,
  Badge,
  Empty,
  PageHeader,
  Panel,
  Pagination,
  QueryState,
} from '../../shared/ui';
export function IntegrationsPage() {
  const query = useQuery({
    queryKey: ['integrations'],
    queryFn: ({ signal }) => integrationApi.list(signal),
    refetchInterval: 30_000,
  });
  return (
    <>
      <PageHeader
        title="Интеграции"
        subtitle="Состояние источников и история обмена"
      />
      <QueryState query={query} />
      {query.data?.map((source) => (
        <IntegrationCard key={source.source} source={source} />
      ))}
    </>
  );
}
function IntegrationCard({ source }: { source: Integration }) {
  const { can } = useSession();
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['integration-runs', source.source, page],
    queryFn: ({ signal }) => integrationApi.runs(source.source, page, signal),
    refetchInterval: 30_000,
  });
  const sync = useAction(
    () => integrationApi.sync(source.source),
    ['integrations', 'integration-runs'],
  );
  return (
    <Panel>
      <div className="section-heading">
        <h2>{source.source === 'LMS' ? 'LMS ИТ Школы' : 'Сайт ИТ Школы'}</h2>
        <Badge>
          {source.availability === 'READY' ? 'Подключён' : 'Не подключён'}
        </Badge>
      </div>
      {source.availability === 'NOT_IMPLEMENTED' && (
        <p className="muted">
          Обмен будет доступен после согласования и подключения источника.
        </p>
      )}
      <dl className="details-list">
        <dt>Последняя попытка</dt>
        <dd>{date(source.lastRun?.createdAt)}</dd>
        <dt>Следующий обмен</dt>
        <dd>{date(source.nextRunAt)}</dd>
        <dt>Интервал</dt>
        <dd>{Math.round(source.intervalSeconds / 60)} мин.</dd>
      </dl>
      {can('integrations.sync') && (
        <button
          className="button button-primary"
          disabled={
            source.availability !== 'READY' ||
            sync.isPending ||
            source.lastRun?.status === 'QUEUED' ||
            source.lastRun?.status === 'RUNNING'
          }
          onClick={() => sync.mutate(undefined)}
        >
          Запустить синхронизацию
        </button>
      )}
      <ActionState action={sync} />
      <h3>История</h3>
      <QueryState query={history} />
      {history.data && (
        <>
          {history.data.rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Запуск</th>
                    <th>Статус</th>
                    <th>Попытки</th>
                    <th>Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.rows.map((run) => (
                    <tr key={run.id}>
                      <td>{date(run.createdAt)}</td>
                      <td>
                        {run.trigger === 'MANUAL' ? 'Вручную' : 'По расписанию'}
                      </td>
                      <td>{runNames[run.status] ?? run.status}</td>
                      <td>{run.attempts}</td>
                      <td>
                        {run.errorCode ? 'Обмен завершился ошибкой' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Запусков пока нет.</Empty>
          )}
          <Pagination
            page={page}
            total={history.data.total}
            size={25}
            onChange={setPage}
          />
        </>
      )}
    </Panel>
  );
}
const runNames: Record<string, string> = {
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  SUCCEEDED: 'Успешно',
  FAILED: 'Ошибка',
};

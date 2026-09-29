import { useQuery } from '@tanstack/react-query';
import { projectApi, eventNames } from '../../entities/project';
import { date, employeeName } from '../../shared/lib';
import { Empty, Panel, QueryState } from '../../shared/ui';
export function ProjectHistory({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['history', id],
    queryFn: ({ signal }) => projectApi.history(id, signal),
  });
  return (
    <Panel>
      <h2>История проекта</h2>
      <QueryState query={query} />
      {query.data &&
        (!query.data.length ? (
          <Empty />
        ) : (
          <ol className="activity-timeline">
            {[...query.data].reverse().map((event) => (
              <li className="activity-entry" key={event.id}>
                <div className="activity-copy">
                  <strong>
                    {eventNames[event.type] ?? 'Изменение проекта'}
                  </strong>
                  <p>
                    {employeeName(event.actor)} · {date(event.createdAt)}
                  </p>
                  {typeof event.details?.fileName === 'string' && (
                    <small>{event.details.fileName}</small>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ))}
    </Panel>
  );
}

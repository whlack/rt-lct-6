import { useQuery } from '@tanstack/react-query';
import { projectApi, eventTitle, type Stage } from '../../entities/project';
import { date, employeeName } from '../../shared/lib';
import { Empty, Panel, QueryState } from '../../shared/ui';
export function ProjectHistory({
  id,
  stages,
}: {
  id: string;
  stages: Stage[];
}) {
  const query = useQuery({
    queryKey: ['history', id],
    queryFn: ({ signal }) => projectApi.history(id, signal),
  });
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.title]));
  return (
    <Panel>
      <h2>История проекта</h2>
      <QueryState query={query} />
      {query.data &&
        (!query.data.length ? (
          <Empty />
        ) : (
          <ol className="project-history-timeline">
            {[...query.data].reverse().map((event) => (
              <li className="project-history-event" key={event.id}>
                <div className="activity-copy">
                  <strong>{eventTitle(event, stageNames)}</strong>
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

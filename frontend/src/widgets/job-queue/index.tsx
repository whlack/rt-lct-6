import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { jobApi, jobNames, shouldPoll, useJobs } from '../../entities/job';
import { useAction } from '../../shared/lib';
import { ActionState, Panel, QueryState } from '../../shared/ui';
export function JobQueue() {
  const { jobs, add, remove } = useJobs();
  const [params, setParams] = useSearchParams();
  const restored = params.get('job');
  useEffect(() => {
    if (restored && /^[0-9a-f-]{36}$/i.test(restored))
      add(restored, 'Выгрузка');
  }, [add, restored]);
  return jobs.length ? (
    <Panel className="report-queue">
      <h2>Очередь выгрузок</h2>
      <p className="muted">
        Файлы доступны ограниченное время. При скачивании права проверяются
        повторно.
      </p>
      {jobs.map((job) => (
        <JobItem
          key={job.id}
          {...job}
          onRemove={() => {
            remove(job.id);
            if (restored === job.id)
              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete('job');
                  return next;
                },
                { replace: true },
              );
          }}
        />
      ))}
    </Panel>
  ) : null;
}
function JobItem({
  id,
  title,
  onRemove,
}: {
  id: string;
  title: string;
  onRemove: () => void;
}) {
  const query = useQuery({
    queryKey: ['jobs', id],
    queryFn: ({ signal }) => jobApi.get(id, signal),
    refetchInterval: (query) =>
      query.state.error
        ? false
        : shouldPoll(query.state.data?.status)
          ? 2000
          : false,
  });
  const download = useAction(() => jobApi.download(id));
  return (
    <article className="list-row">
      <div>
        <strong>{title}</strong>
        <QueryState query={query} />
        {query.data && (
          <>
            <p>
              {jobNames[query.data.status]} · {query.data.progress}%
            </p>
            {query.data.status === 'FAILED' && (
              <p className="error-message">
                Не удалось подготовить файл. Создайте задание заново.
              </p>
            )}
          </>
        )}
        <ActionState action={download} />
      </div>
      <div className="flex gap-2">
        <button
          className="button"
          disabled={query.data?.status !== 'SUCCEEDED' || download.isPending}
          onClick={() => download.mutate(undefined)}
        >
          Скачать
        </button>
        <button
          className="button"
          onClick={onRemove}
          aria-label={`Убрать задание ${title}`}
        >
          ×
        </button>
      </div>
    </article>
  );
}

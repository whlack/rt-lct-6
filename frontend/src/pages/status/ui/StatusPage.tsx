import { useQuery } from '@tanstack/react-query';
import { getApiStatus } from '../../../shared/api/status';

export function StatusPage() {
  const { isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['api', 'ready'],
    queryFn: getApiStatus,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="mb-3 text-sm font-semibold tracking-widest text-cyan-400 uppercase">
          CRM
        </p>
        <h1 className="text-3xl font-semibold">Рабочее пространство</h1>
        <p className="mt-3 text-slate-400">Проверка соединения с сервером</p>
        <div
          className="mt-8 rounded-xl bg-slate-800 p-5"
          role="status"
          aria-live="polite"
        >
          {isPending
            ? 'Подключаемся к API…'
            : isError
              ? 'API недоступен'
              : 'API работает'}
        </div>
        {isError && (
          <button
            className="mt-5 rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-50"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Повторить проверку
          </button>
        )}
      </section>
    </main>
  );
}

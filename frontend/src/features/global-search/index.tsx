import { useState, useDeferredValue } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectApi, offering } from '../../entities/project';
import { universityApi } from '../../entities/university';
import { useSession } from '../../shared/session';
import { Empty, LineIcon, Modal, QueryState } from '../../shared/ui';
export function CommandPalette({
  onClose,
  sections,
}: {
  onClose: () => void;
  sections: { path: string; title: string; icon: string }[];
}) {
  const { can } = useSession();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const term = input.trim();
  const query = useDeferredValue(term);
  const fresh = query === term;
  const [index, setIndex] = useState(0);
  const [universities, projects] = useQueries({
    queries: [
      {
        queryKey: ['universities'],
        queryFn: ({ signal }) => universityApi.list(signal),
        enabled: can('universities.read'),
      },
      {
        queryKey: ['projects', { search: query, pageSize: 8 }],
        queryFn: ({ signal }) =>
          projectApi.list({ search: query, pageSize: 8 }, signal),
        enabled: can('projects.read') && query.length > 0,
      },
    ],
  });
  const lower = term.toLocaleLowerCase('ru');
  const results = [
    ...sections.filter((item) =>
      item.title.toLocaleLowerCase('ru').includes(lower),
    ),
    ...(term && can('universities.read')
      ? (universities.data ?? [])
          .filter((item) => item.name.toLocaleLowerCase('ru').includes(lower))
          .slice(0, 6)
          .map((item) => ({
            path: `/universities/${item.id}`,
            title: item.name,
            icon: 'universities',
          }))
      : []),
    // A deferred request must never leave an old result available to Enter or click.
    ...(term && fresh && can('projects.read')
      ? (projects.data?.rows ?? []).map((item) => ({
          path: `/projects/${item.id}`,
          title: `${offering(item)} · ${item.university.name}`,
          icon: 'project',
        }))
      : []),
  ].slice(0, 16);
  function open(path: string) {
    navigate(path);
    onClose();
  }
  const active = Math.min(index, Math.max(0, results.length - 1));
  return (
    <Modal title="Быстрый поиск" onClose={onClose}>
      <label className="field">
        <span>Раздел, вуз, программа, продукт или договор</span>
        <input
          autoFocus
          role="combobox"
          aria-autocomplete="list"
          aria-controls="command-results"
          aria-expanded="true"
          aria-activedescendant={
            results.length ? `command-${active}` : undefined
          }
          value={input}
          maxLength={200}
          aria-busy={!fresh || (Boolean(term) && projects.isFetching)}
          onChange={(event) => {
            setInput(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setIndex(
                (current) =>
                  (current +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    results.length) %
                  Math.max(1, results.length),
              );
            } else if (event.key === 'Enter' && results[active]) {
              event.preventDefault();
              open(results[active].path);
            }
          }}
        />
      </label>
      {query && can('projects.read') && <QueryState query={projects} />}
      <div
        id="command-results"
        role="listbox"
        aria-label="Результаты поиска"
        className="command-results"
      >
        {results.map((item, position) => (
          <button
            role="option"
            aria-selected={position === active}
            id={`command-${position}`}
            className="command-result"
            key={item.path}
            onClick={() => open(item.path)}
          >
            <LineIcon name={item.icon} />
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      {!results.length && <Empty>Совпадений нет.</Empty>}
    </Modal>
  );
}

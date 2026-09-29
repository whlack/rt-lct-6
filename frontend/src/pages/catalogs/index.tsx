import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  catalogApi,
  catalogNames,
  type CatalogKind,
} from '../../entities/catalog';
import { useSession } from '../../features/session';
import type { Named } from '../../shared/api';
import { formText, useAction } from '../../shared/lib';
import {
  ActionState,
  Empty,
  Field,
  Form,
  Modal,
  PageHeader,
  Panel,
  QueryState,
  Submit,
} from '../../shared/ui';
export function CatalogsPage() {
  const { can } = useSession();
  const [kind, setKind] = useState<CatalogKind>('directions');
  const [editing, setEditing] = useState<Named | 'new'>();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['catalogs', kind],
    queryFn: ({ signal }) => catalogApi.list(kind, signal),
  });
  const save = useAction(
    (name: string) =>
      catalogApi.save(
        kind,
        name,
        typeof editing === 'object' ? editing.id : undefined,
      ),
    ['catalogs', 'projects', 'reports'],
  );
  const rows =
    query.data?.filter((item) =>
      item.name
        .toLocaleLowerCase('ru')
        .includes(search.toLocaleLowerCase('ru')),
    ) ?? [];
  return (
    <>
      <PageHeader title="Каталоги" subtitle="Направления, программы и продукты">
        {can('catalogs.manage') && (
          <button
            className="button button-primary"
            onClick={() => {
              save.reset();
              setEditing('new');
            }}
          >
            + Добавить
          </button>
        )}
      </PageHeader>
      <nav className="entity-tabs" aria-label="Виды каталогов">
        {(Object.keys(catalogNames) as CatalogKind[]).map((key) => (
          <button
            className="button"
            key={key}
            aria-pressed={key === kind}
            onClick={() => {
              setKind(key);
              setSearch('');
            }}
          >
            {catalogNames[key]}
          </button>
        ))}
      </nav>
      <Panel>
        <Field label="Поиск">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <QueryState query={query} />
        {query.data &&
          (!rows.length ? (
            <Empty />
          ) : (
            <div className="list-stack">
              {rows.map((item) => (
                <div className="list-row" key={item.id}>
                  <strong>{item.name}</strong>
                  {can('catalogs.manage') && (
                    <button
                      className="button"
                      onClick={() => {
                        save.reset();
                        setEditing(item);
                      }}
                    >
                      Изменить
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
      </Panel>
      {editing && (
        <Modal
          title={
            typeof editing === 'object' ? 'Изменить название' : 'Новая запись'
          }
          onClose={() => setEditing(undefined)}
        >
          <Form
            onSubmit={(data) =>
              save.mutate(formText(data, 'name'), {
                onSuccess: () => setEditing(undefined),
              })
            }
          >
            <Field label="Название">
              <input
                name="name"
                required
                maxLength={250}
                defaultValue={typeof editing === 'object' ? editing.name : ''}
              />
            </Field>
            <ActionState action={save} />
            <Submit pending={save.isPending} />
          </Form>
        </Modal>
      )}
    </>
  );
}

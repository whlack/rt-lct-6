import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { universityApi } from '../../entities/university';
import { useSession } from '../../features/session';
import { useAction, formText } from '../../shared/lib';
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
export function UniversitiesPage() {
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(false);
  const search = params.get('search') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = useQuery({
    queryKey: ['universities'],
    queryFn: ({ signal }) => universityApi.list(signal),
  });
  const action = useAction(
    (name: string) => universityApi.create(name),
    ['universities', 'dashboard'],
  );
  const rows =
    query.data?.filter((item) =>
      item.name
        .toLocaleLowerCase('ru')
        .includes(search.toLocaleLowerCase('ru')),
    ) ?? [];
  return (
    <>
      <PageHeader
        title="Вузы"
        subtitle="Партнёры, контакты и проекты сотрудничества"
      >
        {can('universities.create') && (
          <button
            className="button button-primary"
            onClick={() => {
              action.reset();
              setCreate(true);
            }}
          >
            + Добавить вуз
          </button>
        )}
      </PageHeader>
      <Panel>
        <label className="field">
          <span>Поиск по названию</span>
          <input
            value={search}
            placeholder="Название вуза"
            onChange={(event) =>
              setParams(
                event.target.value ? { search: event.target.value } : {},
              )
            }
          />
        </label>
        <QueryState query={query} />
        {query.data && (
          <>
            {!rows.length ? (
              <Empty />
            ) : (
              <div className="university-grid">
                {rows.slice((page - 1) * 18, page * 18).map((item) => (
                  <Link
                    className="university-card"
                    key={item.id}
                    to={`/universities/${item.id}`}
                  >
                    <div className="university-avatar">
                      {item.name.slice(0, 2).toUpperCase()}
                    </div>
                    <h2>{item.name}</h2>
                    <p className="muted">
                      {item.primaryContactId
                        ? 'Основной контакт назначен'
                        : 'Основной контакт не назначен'}
                    </p>
                    <span className="text-link">Открыть карточку →</span>
                  </Link>
                ))}
              </div>
            )}
            <Pagination
              page={page}
              total={rows.length}
              size={18}
              onChange={(value) =>
                setParams({
                  ...(search ? { search } : {}),
                  page: String(value),
                })
              }
            />
          </>
        )}
      </Panel>
      {create && (
        <Modal title="Новый вуз" onClose={() => setCreate(false)}>
          <Form
            onSubmit={(data) =>
              action.mutate(formText(data, 'name'), {
                onSuccess: () => setCreate(false),
              })
            }
          >
            <Field label="Название">
              <input name="name" required maxLength={250} />
            </Field>
            <ActionState action={action} />
            <Submit pending={action.isPending}>Добавить вуз</Submit>
          </Form>
        </Modal>
      )}
    </>
  );
}

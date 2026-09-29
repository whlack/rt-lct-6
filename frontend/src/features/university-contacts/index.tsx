import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { universityApi, type Contact } from '../../entities/university';
import { useSession } from '../../shared/session';
import { useAction, formText } from '../../shared/lib';
import {
  ActionState,
  Badge,
  Empty,
  Field,
  Form,
  Modal,
  Panel,
  QueryState,
  Submit,
} from '../../shared/ui';
export function UniversityContacts({
  id,
  primaryContactId,
}: {
  id: string;
  primaryContactId: string | null;
}) {
  const { can } = useSession();
  const [editing, setEditing] = useState<Contact | 'new'>();
  const query = useQuery({
    queryKey: ['contacts', id],
    queryFn: ({ signal }) => universityApi.contacts(id, signal),
    enabled: can('university_contacts.read'),
  });
  const save = useAction(
    (data: FormData) =>
      universityApi.contact(
        id,
        {
          name: formText(data, 'name'),
          email: formText(data, 'email') || null,
          phone: formText(data, 'phone') || null,
        },
        typeof editing === 'object' ? editing.id : undefined,
      ),
    ['contacts', 'universities'],
  );
  const primary = useAction(
    (contactId: string) => universityApi.primary(id, contactId),
    ['universities'],
  );
  if (!can('university_contacts.read')) return null;
  const initial = typeof editing === 'object' ? editing : undefined;
  return (
    <Panel>
      <div className="section-heading">
        <h2>Контакты вуза</h2>
        {can('university_contacts.create') && (
          <button
            className="button"
            onClick={() => {
              save.reset();
              setEditing('new');
            }}
          >
            + Контакт
          </button>
        )}
      </div>
      <QueryState query={query} />
      {query.data &&
        (!query.data.length ? (
          <Empty />
        ) : (
          <div className="list-stack">
            {query.data.map((contact) => (
              <article className="list-row" key={contact.id}>
                <div>
                  <strong>{contact.name}</strong>
                  {contact.id === primaryContactId && <Badge>Основной</Badge>}
                  <p className="muted">
                    {contact.email ?? ''} {contact.phone ?? ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {can('university_contacts.update') && (
                    <button
                      className="button"
                      onClick={() => {
                        save.reset();
                        setEditing(contact);
                      }}
                    >
                      Изменить
                    </button>
                  )}
                  {can('universities.update') &&
                    contact.id !== primaryContactId && (
                      <button
                        className="button"
                        disabled={primary.isPending}
                        onClick={() => primary.mutate(contact.id)}
                      >
                        Сделать основным
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        ))}
      <ActionState action={primary} />
      {editing && (
        <Modal
          title={initial ? 'Изменить контакт' : 'Новый контакт'}
          onClose={() => setEditing(undefined)}
        >
          <Form
            onSubmit={(data) => {
              if (!formText(data, 'email') && !formText(data, 'phone')) {
                const input = document.querySelector<HTMLInputElement>(
                  'dialog input[name=email]',
                );
                input?.setCustomValidity('Укажите email или телефон.');
                input?.reportValidity();
                return;
              }
              save.mutate(data, { onSuccess: () => setEditing(undefined) });
            }}
          >
            <Field label="ФИО">
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={initial?.name}
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                maxLength={254}
                defaultValue={initial?.email ?? ''}
                onChange={(event) => event.target.setCustomValidity('')}
              />
            </Field>
            <Field label="Телефон">
              <input
                name="phone"
                maxLength={40}
                defaultValue={initial?.phone ?? ''}
                onChange={() =>
                  document
                    .querySelector<HTMLInputElement>('dialog input[name=email]')
                    ?.setCustomValidity('')
                }
              />
            </Field>
            <p className="muted">Укажите хотя бы один способ связи.</p>
            <ActionState action={save} />
            <Submit pending={save.isPending} />
          </Form>
        </Modal>
      )}
    </Panel>
  );
}

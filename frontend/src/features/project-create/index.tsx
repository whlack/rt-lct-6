import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectApi, type ProjectCreate } from '../../entities/project';
import { catalogApi } from '../../entities/catalog';
import { universityApi } from '../../entities/university';
import { employeeApi } from '../../entities/employee';
import { useAction, formText, employeeName } from '../../shared/lib';
import {
  ActionState,
  Field,
  Form,
  Modal,
  QueryState,
  Submit,
} from '../../shared/ui';
export function ProjectCreateForm({
  universityId,
  onClose,
}: {
  universityId?: string;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<'programs' | 'products'>('programs');
  const navigate = useNavigate();
  const [universities, directions, programs, products, employees] = useQueries({
    queries: [
      {
        queryKey: ['universities'],
        queryFn: ({ signal }) => universityApi.list(signal),
      },
      {
        queryKey: ['catalogs', 'directions'],
        queryFn: ({ signal }) => catalogApi.list('directions', signal),
      },
      {
        queryKey: ['catalogs', 'programs'],
        queryFn: ({ signal }) => catalogApi.list('programs', signal),
      },
      {
        queryKey: ['catalogs', 'products'],
        queryFn: ({ signal }) => catalogApi.list('products', signal),
      },
      {
        queryKey: ['employees'],
        queryFn: ({ signal }) => employeeApi.list(signal),
      },
    ],
  });
  const create = useAction(
    (body: ProjectCreate) => projectApi.create(body),
    ['projects', 'dashboard'],
  );
  const pending = [
    universities,
    directions,
    programs,
    products,
    employees,
  ].find((query) => query.isPending || query.isError);
  return (
    <Modal title="Новый проект" onClose={onClose}>
      {pending ? (
        <QueryState query={pending} />
      ) : (
        <Form
          onSubmit={(data) => {
            const body: ProjectCreate = {
              universityId: formText(data, 'universityId'),
              directionId: formText(data, 'directionId'),
              responsibleSubject: formText(data, 'responsibleSubject'),
              ...(kind === 'programs'
                ? { programId: formText(data, 'offeringId') }
                : { productId: formText(data, 'offeringId') }),
            };
            create.mutate(body, {
              onSuccess: (result) => {
                onClose();
                navigate(`/projects/${result.id}`);
              },
            });
          }}
        >
          <Field label="Вуз">
            <select
              name="universityId"
              required
              defaultValue={universityId ?? ''}
            >
              <option value="" disabled>
                Выберите вуз
              </option>
              {universities.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ИТ-направление">
            <select name="directionId" required defaultValue="">
              <option value="" disabled>
                Выберите направление
              </option>
              {directions.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Тип проекта">
            <select
              value={kind}
              onChange={(event) =>
                setKind(
                  event.target.value === 'programs' ? 'programs' : 'products',
                )
              }
            >
              <option value="programs">Программа</option>
              <option value="products">Продукт</option>
            </select>
          </Field>
          <Field label={kind === 'programs' ? 'Программа' : 'Продукт'}>
            <select name="offeringId" key={kind} required defaultValue="">
              <option value="" disabled>
                Выберите значение
              </option>
              {(kind === 'programs' ? programs : products).data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ответственный КАМ">
            <select name="responsibleSubject" required defaultValue="">
              <option value="" disabled>
                Выберите сотрудника
              </option>
              {employees.data?.map((item) => (
                <option key={item.subject} value={item.subject}>
                  {employeeName(item)}
                </option>
              ))}
            </select>
          </Field>
          <p className="muted">
            Проект будет создан со стандартной последовательностью этапов.
            Сведения о договоре и лицензии можно добавить в карточке.
          </p>
          <ActionState action={create} />
          <Submit pending={create.isPending}>Создать проект</Submit>
        </Form>
      )}
    </Modal>
  );
}

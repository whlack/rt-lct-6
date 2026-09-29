import {
  array,
  integer,
  object,
  text,
  uuid,
} from '../../../common/api-schema.js';

/** Проекция сотрудника Keycloak; локальное ФИО не изменяет исходный профиль. */
export const employeeSchema = object({
  subject: {
    ...uuid,
    description:
      'Идентификатор Keycloak; используется для назначения, а не локальный User.id.',
  },
  email: { ...text, format: 'email', example: 'kam@example.org' },
  name: { ...text, example: 'Тестовый сотрудник' },
});

/** name и email отсутствуют, если профиль не содержит соответствующих значений. */
export const meSchema = {
  ...object({
    id: uuid,
    subject: uuid,
    level: { ...integer, enum: [10, 20, 30], example: 10 },
    email: { ...text, format: 'email', example: 'kam@example.org' },
    name: { ...text, example: 'Тестовый сотрудник' },
    visibility: object({
      mode: {
        ...text,
        enum: ['ASSIGNED', 'ALL', 'SELECTED'],
        example: 'ASSIGNED',
      },
      universityIds: array(uuid),
      projectIds: array(uuid),
    }),
    permissions: {
      ...array(text),
      example: ['projects.read', 'universities.read'],
    },
  }),
  required: ['id', 'subject', 'level', 'visibility', 'permissions'],
};

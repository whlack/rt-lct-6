import { object, text, integer, uuid } from '../../../common/api-schema.js';
/** Список прав и изменение уровня возвращают одинаковую проекцию записи. */
export const permissionSchema = object({
  id: uuid,
  key: {
    ...text,
    example: 'projects.read',
    description: 'Уникальный ключ права операции.',
  },
  minimumLevel: {
    ...integer,
    enum: [10, 20, 30],
    example: 10,
    description:
      'Минимальный уровень роли; специальные административные права всегда требуют 30.',
  },
});

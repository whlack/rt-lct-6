import { dateTime, integer, object } from '../../../common/api-schema.js';
/** Все счётчики получены в одном REPEATABLE READ снимке и с областью видимости автора. */
export const dashboardSchema = object({
  universities: {
    ...integer,
    minimum: 0,
    example: 12,
    description: 'Количество всех доступных вузов.',
  },
  activeProjects: {
    ...integer,
    minimum: 0,
    example: 8,
    description: 'Доступные проекты с closedAt=null.',
  },
  actionRequiredProjects: {
    ...integer,
    minimum: 0,
    example: 3,
    description: 'Открытые проекты, текущий этап которых ожидает KAM.',
  },
  calculatedAt: { ...dateTime, description: 'Время расчёта счётчиков.' },
});

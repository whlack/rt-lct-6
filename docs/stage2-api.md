# Серверный этап 2

Frontend остаётся отдельным этапом. Новые права: dashboard.read — 10; reports.read, reports.export, statistics.read — 20. Импорт использует catalogs.import — 20. Право не заменяет проверку видимости данных.

## Показатели

GET /api/dashboard возвращает universities, activeProjects, actionRequiredProjects, calculatedAt. Вузы — все доступные. Активный проект не закрыт; требует действий, если текущий этап ожидает KAM. Счётчик не ограничивается проектами, за которые лично отвечает вызывающий КАМ.

## Отчёты

GET /api/reports/projects принимает dateFrom/dateTo (YYYY-MM-DD, только вместе), universityId, directionId, programId либо productId, responsibleSubject и status (ACTIVE/CLOSED). Период выбирает проекты с событиями истории; поля отражают текущее состояние. Границы дней вычисляются в REPORT_TIMEZONE (Europe/Moscow). page — от 1, pageSize — 1–100, по умолчанию 25.

GET /api/reports/projects/:id возвращает полный отчёт без периода: этапы, требования документов, метаданные файлов, комментарии и события. Текст удалённых комментариев и ключи S3 не выдаются.

Пустая выборка — 200 с пустыми rows и total=0; недоступный конкретный проект — 404; неправильные фильтры — 400; отсутствие токена — 401; отсутствие права — 403.

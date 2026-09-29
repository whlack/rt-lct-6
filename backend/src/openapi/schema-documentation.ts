import type {
  OpenAPIObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger';
import { keycloakRealm } from '../config/keycloak.js';

// Общий словарь только поясняет повторяющиеся поля; правила и ограничения остаются в DTO/операциях.
const descriptions: Record<string, string> = {
  id: 'Идентификатор записи CRM.',
  projectId: 'Идентификатор проекта.',
  project: 'Краткие сведения проекта, к которому относится запись.',
  statusCode: 'HTTP-код ответа.',
  error: 'Стандартное название HTTP-ошибки.',
  subject: 'Идентификатор сотрудника Keycloak.',
  keycloakSubject: 'Идентификатор пользователя Keycloak.',
  name: 'Отображаемое имя или название.',
  displayName:
    'Отображаемое имя с учётом локального переопределения; null, если не задано.',
  email: 'Адрес электронной почты.',
  level: 'Уровень роли CRM: 10, 20 или 30.',
  permissions: 'Эффективные ключи прав текущего пользователя.',
  visibility: 'Политика видимости предметных данных.',
  mode: 'Режим видимости: ASSIGNED, ALL или SELECTED.',
  universityIds: 'Явно разрешённые вузы режима SELECTED.',
  projectIds: 'Явно разрешённые проекты режима SELECTED.',
  key: 'Ключ права либо нормализованный ключ строки импорта.',
  minimumLevel: 'Минимальный уровень роли для операции.',
  universityId: 'Идентификатор вуза.',
  university: 'Краткие сведения вуза.',
  directionId: 'Идентификатор направления.',
  direction: 'Краткие сведения направления.',
  programId: 'Идентификатор программы; null, если выбран продукт.',
  program: 'Программа либо null при выборе продукта.',
  productId: 'Идентификатор продукта; null, если выбрана программа.',
  product: 'Продукт либо null при выборе программы.',
  responsibleSubject: 'Идентификатор ответственного КАМ в Keycloak.',
  responsibleId: 'Локальный ID ответственного КАМ.',
  responsible: 'Ответственный КАМ.',
  supervisorId: 'Локальный ID руководителя; null, если не назначен.',
  supervisor: 'Руководитель либо null.',
  createdById: 'Локальный ID автора записи.',
  userId: 'Локальный ID сотрудника.',
  user: 'Проекция назначенного сотрудника.',
  assignments: 'Назначения сотрудников на вуз.',
  primaryContactId: 'Основной контакт вуза либо null.',
  normalizedName: 'Название, нормализованное PostgreSQL для уникальности.',
  phone: 'Телефон контактного лица.',
  createdAt: 'Время создания в ISO 8601.',
  updatedAt: 'Время последнего изменения в ISO 8601.',
  closedAt: 'Время закрытия проекта; null для активного.',
  deletedAt: 'Время удаления комментария; null для неудалённого.',
  startedAt: 'Время начала выполнения; null до запуска.',
  completedAt: 'Время окончания; null до завершения.',
  expiresAt: 'Срок хранения результата; после него скачивание недоступно.',
  generatedAt: 'Время формирования данных ответа.',
  calculatedAt: 'Время расчёта показателей.',
  vendor: 'Вендор проекта либо null.',
  contractNumber: 'Номер договора либо null.',
  licenseSignedAt: 'Дата подписания лицензии либо null.',
  licenseExpiresYear: 'Год окончания лицензии либо null.',
  transferStatus: 'Статус передачи: NOT_STARTED, IN_PROGRESS, COMPLETED.',
  currentStageIndex: 'Позиция текущего этапа, начиная с нуля.',
  currentStage: 'Текущий этап либо null.',
  workflowLocked: 'Признак запрета изменения workflow после первого перехода.',
  stages: 'Этапы проекта в порядке прохождения.',
  stageCount: 'Общее число этапов workflow проекта.',
  stageId: 'Идентификатор этапа.',
  title: 'Название этапа.',
  position: 'Позиция этапа, начиная с нуля.',
  expectedActor: 'Ожидаемая сторона: KAM или UNIVERSITY.',
  expectedContactId: 'Ожидаемый контакт вуза либо null.',
  expectedContact: 'Ожидаемый контакт вуза либо null.',
  documentTypes: 'Требования к документам этапа.',
  documentTypeId: 'Идентификатор требования к документу.',
  isRequired: 'Документ обязателен для перехода или закрытия.',
  files: 'Метаданные документов без ключей S3.',
  fileName: 'Исходное имя файла.',
  file: 'Файл multipart/form-data.',
  mimeType: 'MIME-тип документа.',
  size: 'Размер файла в байтах.',
  uploadedById: 'Локальный ID автора загрузки.',
  uploadedBy: 'Автор загрузки.',
  comments: 'Комментарии и ответы, включая удалённые записи без текста.',
  parentId: 'Родительский комментарий либо null.',
  body: 'Текст комментария; null после удаления.',
  authorId: 'Локальный ID автора.',
  author: 'Автор комментария.',
  events: 'Хронология значимых событий.',
  actorId: 'Локальный ID автора события.',
  actor: 'Автор события.',
  type: 'Тип события либо программы/продукта.',
  objectType: 'Тип затронутого объекта.',
  objectId: 'Идентификатор затронутого объекта.',
  details: 'Дополнительные сведения события; набор полей зависит от type.',
  rows: 'Записи выбранной страницы.',
  total: 'Общее количество подходящих записей.',
  page: 'Номер страницы, начиная с 1.',
  pageSize: 'Размер страницы, по умолчанию 25, максимум 100.',
  filters:
    'Применённые параметры запроса; отсутствующие фильтры не включаются.',
  timezone: 'Часовой пояс REPORT_TIMEZONE; по умолчанию Europe/Moscow.',
  offering: 'Выбранная программа или продукт.',
  status: 'Состояние объекта; допустимые значения указаны в enum.',
  kind: 'Вид задания: export или import.',
  progress: 'Прогресс от 0 до 100 процентов.',
  errorCode: 'Безопасный технический код ошибки либо null.',
  phase: 'Фаза импорта: VALIDATE — проверка, APPLY — применение.',
  counts: 'Счётчики строк по категориям; конкретные ключи зависят от фазы.',
  sheet: 'Название листа книги.',
  rowNumber: 'Номер строки в исходном листе, начиная с 1.',
  data: 'Подготовленные значения строки: name; либо type/name; либо email/name, в зависимости от листа.',
  action: 'Предварительная категория строки: CREATE, UPDATE, SKIP, ERROR.',
  result: 'Итог обработки строки: PENDING, CREATED, UPDATED, SKIPPED, ERROR.',
  errors: 'Ошибки проверки или применения строки.',
  column: 'Колонка, к которой относится ошибка.',
  code: 'Безопасный код ошибки строки.',
  message: 'Сообщение сервера; ошибки валидации могут быть массивом.',
  processedAt: 'Время обработки строки; null до применения.',
  active: 'Число активных проектов.',
  closed: 'Число закрытых проектов.',
  directions: 'Распределение проектов по направлениям.',
  count: 'Количество проектов.',
  months: 'Помесячные значения, включая месяцы с нулевыми значениями.',
  month: 'Месяц в формате YYYY-MM.',
  created: 'Количество созданных проектов за месяц.',
  keycloak: 'Публичная конфигурация входа.',
  url: 'Публичный URL Keycloak.',
  realm: 'Имя realm CRM.',
  clientId: 'Публичный клиент браузера.',
  source: 'Источник интеграции LMS или WEBSITE.',
  trigger: 'Ручной или плановый запуск.',
  initiatorId: 'Локальный ID инициатора; null для планового запуска.',
  attempts: 'Число начатых попыток выполнения.',
  nextAttemptAt: 'Время следующей попытки либо null.',
  scheduledAt: 'Плановый слот запуска; null для ручного запроса.',
  availability: 'Готовность источника: сейчас NOT_IMPLEMENTED.',
  reason: 'Причина недоступности источника либо null.',
  intervalSeconds: 'Интервал запуска в секундах.',
  nextRunAt: 'Следующий запуск либо null для неготового источника.',
  lastRun: 'Последнее задание либо null.',
  runId: 'Идентификатор принятого запуска.',
};

const examples: Record<string, unknown> = {
  page: 1,
  pageSize: 25,
  total: 1,
  size: 1024,
  stageCount: 1,
  name: 'Тестовое название',
  title: 'Согласование',
  body: 'Тестовый комментарий',
  email: 'employee@example.org',
  phone: '+7 000 000-00-00',
  timezone: 'Europe/Moscow',
  month: '2026-01',
  url: 'http://localhost:8080',
  realm: keycloakRealm(),
  clientId: 'crm-web',
  fileName: 'test-document.pdf',
  mimeType: 'application/pdf',
  keycloakSubject: '66666666-6666-4666-8666-666666666666',
};

/** Дополняет только пояснения ручных схем; типы, обязательность и ограничения не угадываются. */
function describe(
  schema: SchemaObject | ReferenceObject,
): SchemaObject | ReferenceObject {
  if ('$ref' in schema) return { ...schema };
  // Ручные схемы переиспользуют uuid/text/named. Копия на каждом ребре сохраняет разные пояснения полей.
  const result: SchemaObject = { ...schema };
  if (schema.properties)
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, child]) => {
        const annotated = describe(child);
        if (!('$ref' in annotated)) {
          annotated.description ??= descriptions[name];
          if (
            annotated.example === undefined &&
            examples[name] !== undefined &&
            !annotated.enum
          )
            annotated.example = examples[name];
        }
        return [name, annotated];
      }),
    );
  if (schema.items) result.items = describe(schema.items);
  if (schema.oneOf) result.oneOf = schema.oneOf.map(describe);
  if (schema.allOf) result.allOf = schema.allOf.map(describe);
  if (schema.anyOf) result.anyOf = schema.anyOf.map(describe);
  return result;
}

/** Пример ответа собирается из явных схем, а не данных БД; произвольные JSON-поля остаются пустыми. */
function example(
  schema: SchemaObject | ReferenceObject,
  document: OpenAPIObject,
  depth = 0,
): unknown {
  if (depth > 16) return null;
  if ('$ref' in schema) {
    const target =
      document.components?.schemas?.[
        schema.$ref.replace('#/components/schemas/', '')
      ];
    return target ? example(target, document, depth + 1) : null;
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.nullable) return null;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.allOf)
    return Object.assign(
      {},
      ...schema.allOf.map((part) => example(part, document, depth + 1)),
    );
  if (schema.oneOf?.[0]) return example(schema.oneOf[0], document, depth + 1);
  if (schema.type === 'object' || schema.properties)
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([key, value]) => [
        key,
        example(value, document, depth + 1),
      ]),
    );
  if (schema.type === 'array')
    return schema.items ? [example(schema.items, document, depth + 1)] : [];
  if (schema.type === 'integer' || schema.type === 'number')
    return schema.minimum ?? 0;
  if (schema.type === 'boolean') return false;
  if (schema.format === 'uuid') return '11111111-1111-4111-8111-111111111111';
  if (schema.format === 'date-time') return '2026-01-15T09:00:00.000Z';
  if (schema.format === 'date') return '2026-01-15';
  return 'Тестовое значение';
}

/** Единые пояснения и синтетические примеры доступны и UI, и исходным JSON/YAML. */
export function documentSchemas(document: OpenAPIObject): void {
  for (const [name, schema] of Object.entries(
    document.components?.schemas ?? {},
  )) {
    document.components!.schemas![name] = describe(schema);
  }
  for (const [route, path] of Object.entries(document.paths)) {
    if (!path) continue;
    for (const method of [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'head',
      'options',
    ] as const) {
      const operation = path[method];
      if (!operation) continue;
      operation.parameters ??= [];
      operation.parameters.push({
        in: 'header',
        name: 'x-request-id',
        required: false,
        description:
          'Необязательный ID запроса: 1–64 латинских символа, цифры или дефис. При отсутствии/неверном формате сервер создаёт UUID.',
        schema: {
          type: 'string',
          pattern: '^[a-zA-Z0-9-]{1,64}$',
          example: 'crm-test-request-1',
        },
      });
      // tsx не создаёт design:paramtypes: Nest добавляет параметры в ином порядке.
      // Стабилизируем только порядок описания, оставляя сами контракты неизменными.
      // ApiQuery(type) и emitted metadata могут продублировать один параметр в compiled режиме.
      if (operation.parameters)
        operation.parameters = [
          ...new Map(
            operation.parameters.map((parameter) => [
              '$ref' in parameter
                ? parameter.$ref
                : `${parameter.in}:${parameter.name}`,
              parameter,
            ]),
          ).values(),
        ];
      operation.parameters?.sort((left, right) => {
        if ('$ref' in left || '$ref' in right)
          return JSON.stringify(left).localeCompare(JSON.stringify(right));
        if (left.in === 'path' && right.in === 'path')
          return (
            route.indexOf(`{${left.name}}`) - route.indexOf(`{${right.name}}`)
          );
        return `${left.in}:${left.name}`.localeCompare(
          `${right.in}:${right.name}`,
        );
      });
      for (const parameter of operation.parameters ?? []) {
        if ('$ref' in parameter) continue;
        parameter.description ??=
          descriptions[parameter.name] ?? `Параметр ${parameter.name}.`;
        if (parameter.schema) parameter.schema = describe(parameter.schema);
      }
      if (operation.requestBody && !('$ref' in operation.requestBody)) {
        for (const media of Object.values(operation.requestBody.content))
          if (media.schema) media.schema = describe(media.schema);
      }
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!response || '$ref' in response) continue;
        response.headers ??= {};
        response.headers['x-request-id'] = {
          description: 'Идентификатор запроса для поиска в журнале API.',
          schema: { type: 'string' },
        };
        response.description ||=
          Number(status) < 300 ? 'Успешный ответ.' : 'Ошибка запроса.';
        for (const [mime, media] of Object.entries(response.content ?? {})) {
          if (!media.schema) continue;
          media.schema = describe(media.schema);
          if (
            mime === 'application/json' &&
            !media.examples &&
            media.example === undefined
          )
            media.example = example(media.schema, document);
        }
      }
    }
  }
}

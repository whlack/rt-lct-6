import { documentSchemas } from './schema-documentation.js';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Единый документ для watch-запуска, собранного API и проверок контрактов. */
export function createApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('CRM Ростелекома — API')
    .setVersion('0.1.0')
    .setDescription(
      'Серверный API CRM. Публичные операции не требуют входа. Для остальных используйте Authorize и access token Keycloak (без префикса Bearer). ' +
        'Права берутся из /api/me, а область видимости применяется дополнительно на сервере. Уровни ролей: КАМ — 10, руководитель — 20, администратор — 30. ' +
        'Неизвестные поля в body/query DTO отклоняются; UUID и даты проверяются. Время ответа передаётся в ISO 8601. ' +
        'Фоновые операции: создать задание → опрашивать его состояние → скачать готовый результат. Принятие с 202 не означает завершение. ' +
        'LMS и сайт имеют NOT_IMPLEMENTED: ручной запуск возвращает 409 и не создаёт задания. ' +
        'Swagger и исходная спецификация доступны только при NODE_ENV, отличном от production.',
    )
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Access token realm CRM, полученный через Keycloak. Токен не сохраняется Swagger между перезагрузками.',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controller, method) =>
      `${controller.replace(/Controller$/, '')}_${method}`,
  });
  document.tags = [
    ['status', 'Публичная конфигурация, состояние процесса и готовность БД'],
    ['operations', 'Метрики API для администратора'],
    ['auth', 'Текущий пользователь и его эффективные права'],
    ['employees', 'Сотрудники из Keycloak с локальными именами CRM'],
    ['permissions', 'Управление минимальными уровнями прав'],
    ['visibility', 'Политика видимости КАМ'],
    ['catalogs', 'Направления, программы и продукты'],
    ['universities', 'Вузы, контакты и назначения'],
    ['projects', 'Проекты, workflow, комментарии и документы'],
    ['dashboard', 'Показатели главной в области видимости пользователя'],
    ['reports', 'Отчётные данные и создание выгрузок'],
    ['statistics', 'Статистика и выгрузка графиков'],
    ['catalog-imports', 'Проверка и применение XLS/XLSX'],
    ['jobs', 'Состояние собственных заданий и защищённое скачивание'],
    ['integrations', 'Каркас интеграций LMS и сайта без реального обмена'],
  ].map(([name, description]) => ({ name, description }));
  documentSchemas(document);
  return document;
}

/** В production не создаём даже документ: UI, спецификации и ресурсы отсутствуют. */
export function setupOpenApi(
  app: INestApplication,
  environment = process.env.NODE_ENV,
) {
  if (environment === 'production') return;
  SwaggerModule.setup('api/docs', app, () => createApiDocument(app), {
    jsonDocumentUrl: '/api/docs-json',
    yamlDocumentUrl: '/api/docs-yaml',
    customSiteTitle: 'CRM — документация API',
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
    },
  });
}

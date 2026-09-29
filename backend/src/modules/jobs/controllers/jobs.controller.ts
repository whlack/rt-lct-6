import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { attachmentDisposition } from '../../../common/attachment-disposition.js';
import { UuidParam } from '../../../common/validated-input.js';
import { Controller, Get, Inject, Req, StreamableFile } from '@nestjs/common';
import { currentUser, type AuthRequest } from '../../auth/index.js';
import { JobsService } from '../services/jobs.service.js';
@ApiTags('jobs')
@ApiBearerAuth()
@Controller('api/jobs')
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}
  @Get(':id')
  @ApiOperation({
    summary: 'Состояние собственного задания',
    description:
      'Требуется вход и право исходной операции задания. Доступен только автору с текущим правом соответствующей операции: reports.export, statistics.read или catalogs.import. /api/jobs обслуживает только выгрузки и импорт, не синхронизации.',
    operationId: 'jobs_get',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @ApiOkResponse({
    schema: {
      required: [
        'id',
        'kind',
        'status',
        'progress',
        'errorCode',
        'createdAt',
        'startedAt',
        'completedAt',
        'expiresAt',
      ],
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        kind: { type: 'string', enum: ['export', 'import'] },
        status: {
          type: 'string',
          enum: [
            'QUEUED',
            'RUNNING',
            'PREVIEW',
            'SUCCEEDED',
            'FAILED',
            'EXPIRED',
          ],
        },
        progress: { type: 'integer', minimum: 0, maximum: 100 },
        errorCode: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        startedAt: { type: 'string', format: 'date-time', nullable: true },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  get(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.jobs.get(currentUser(request), id);
  }
  @Get(':id/file')
  @ApiOperation({
    summary: 'Скачать результат собственного задания',
    description:
      'Требуется вход и право исходной операции задания. Только автору. Перед скачиванием повторно проверяются текущие роли Keycloak, право и видимость всех включённых проектов. Потеря доступа требует новой выгрузки. 409 — файл ещё не готов; 410 — срок истёк. Прямые S3-ссылки не выдаются.',
    operationId: 'jobs_file',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
    410: 'Срок хранения исходного файла или результата истёк.',
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @ApiOkResponse({
    description: 'Готовый файл. Content-Type соответствует формату результата.',
    headers: {
      'Content-Disposition': {
        description: 'attachment; имя файла в UTF-8.',
        schema: { type: 'string' },
      },
      'Content-Length': {
        description: 'Размер файла в байтах.',
        schema: { type: 'integer' },
      },
    },
    content: Object.fromEntries(
      [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
        'application/json',
        'image/png',
        'application/octet-stream',
      ].map((mime) => [mime, { schema: { type: 'string', format: 'binary' } }]),
    ),
  })
  async file(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    const result = await this.jobs.file(currentUser(request), id);
    return new StreamableFile(result.bytes, {
      type: result.mimeType,
      disposition: attachmentDisposition(result.fileName),
      length: result.bytes.length,
    });
  }
}

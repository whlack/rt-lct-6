import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { UploadLimitInterceptor } from '../../../common/upload-limit.interceptor.js';
import { UuidParam, ValidatedQuery } from '../../../common/validated-input.js';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { positiveInteger } from '../../../config/jobs.js';
import { ImportService } from '../services/import.service.js';
import { PageDto } from '../../../common/page.dto.js';
@ApiTags('catalog-imports')
@ApiBearerAuth()
@RequirePermission('catalogs.import')
@Controller('api/catalog-imports')
export class ImportController {
  constructor(@Inject(ImportService) private readonly imports: ImportService) {}
  @Post()
  @ApiOperation({
    summary: 'Загрузить XLS/XLSX для проверки',
    description:
      'Право: catalogs.import. Один непустой file, по умолчанию до 10 МиБ, 20 000 строк и 50 МиБ распакованного XLSX. Допустима часть листов: Вузы, Направления, Программы и продукты, Сотрудники. Формулы значимых ячеек, неизвестные непустые листы и неверные заголовки — ошибки проверки. 202 запускает VALIDATE; данные пока не применяются.',
    operationId: 'catalog_import_upload',
  })
  @ApiErrors(
    {
      ...authenticationErrors,
      400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
      413: 'Превышен допустимый размер файла.',
      429: 'UPLOAD_LIMIT_REACHED или IMPORT_LIMIT_REACHED: лимит загрузок либо заданий импорта.',
    },
    { 429: 'IMPORT_LIMIT_REACHED' },
  )
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiAcceptedResponse({
    description:
      'Проверка поставлена в очередь; применение требует отдельного apply.',
    schema: {
      required: ['id', 'status'],
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['QUEUED'] },
      },
    },
  })
  @UseInterceptors(
    UploadLimitInterceptor,
    FileInterceptor('file', {
      limits: {
        files: 1,
        fields: 10,
        parts: 11,
        fieldSize: 4096,
        fileSize: positiveInteger('IMPORT_MAX_BYTES', 10485760),
      },
    }),
  )
  upload(
    @Req() request: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imports.upload(currentUser(request), file);
  }
  @Get(':id')
  @ApiOperation({
    summary: 'Результат проверки или применения импорта',
    description:
      'Право: catalogs.import. Только собственный импорт. Постраничные строки, категории CREATE/UPDATE/SKIP/ERROR, результаты и счётчики. PREVIEW означает возможность отдельного apply; XLSX ошибок доступен через /api/jobs/{id}/file, если сформирован.',
    operationId: 'catalog_import_get',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    410: 'Срок хранения исходного файла или результата истёк.',
  })
  @ApiOkResponse({
    schema: {
      required: [
        'id',
        'kind',
        'status',
        'phase',
        'progress',
        'counts',
        'total',
        'page',
        'pageSize',
        'rows',
        'errorCode',
        'createdAt',
        'startedAt',
        'completedAt',
        'expiresAt',
      ],
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        kind: { type: 'string', enum: ['import'] },
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
          example: 'PREVIEW',
        },
        phase: { type: 'string', enum: ['VALIDATE', 'APPLY'] },
        progress: { type: 'integer', minimum: 0, maximum: 100, example: 100 },
        counts: {
          type: 'object',
          additionalProperties: { type: 'integer' },
          example: { total: 1, CREATE: 1, UPDATE: 0, SKIP: 0, ERROR: 0 },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        rows: {
          type: 'array',
          items: {
            required: [
              'id',
              'sheet',
              'rowNumber',
              'key',
              'processedAt',
              'data',
              'action',
              'result',
              'errors',
            ],
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              sheet: { type: 'string', example: 'Вузы' },
              rowNumber: { type: 'integer', example: 2 },
              key: { type: 'string', example: 'тестовый вуз' },
              processedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              data: { type: 'object', example: { name: 'Тестовый вуз' } },
              action: {
                type: 'string',
                enum: ['CREATE', 'UPDATE', 'SKIP', 'ERROR'],
              },
              result: {
                type: 'string',
                enum: ['PENDING', 'CREATED', 'UPDATED', 'SKIPPED', 'ERROR'],
              },
              errors: {
                type: 'array',
                example: [],
                items: {
                  required: ['column', 'code', 'message'],
                  type: 'object',
                  properties: {
                    column: { type: 'string' },
                    code: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        errorCode: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        startedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: '2026-01-15T09:00:00.000Z',
        },
        completedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: '2026-01-15T09:01:00.000Z',
        },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  get(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedQuery(PageDto) query: PageDto,
  ) {
    return this.imports.get(
      currentUser(request),
      id,
      query.page,
      query.pageSize,
    );
  }
  @Post(':id/apply')
  @ApiOperation({
    summary: 'Применить проверенный импорт',
    description:
      'Право: catalogs.import. Только собственный импорт в PREVIEW. Валидные строки применяются отдельно, ошибки не откатывают остальные. Совпадения и доступ проверяются заново. Повторное применение уже запущенной фазы APPLY возвращает её состояние. Учётные записи Keycloak не создаются и не меняются.',
    operationId: 'catalog_import_apply',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
    410: 'Срок хранения исходного файла или результата истёк.',
  })
  @HttpCode(202)
  @ApiAcceptedResponse({
    description:
      'Валидные строки будут повторно проверены и применены; повторный запрос возвращает текущую фазу APPLY.',
    schema: {
      type: 'object',
      required: ['id', 'status'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['QUEUED', 'RUNNING', 'SUCCEEDED'] },
      },
    },
  })
  apply(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.imports.apply(currentUser(request), id);
  }
}

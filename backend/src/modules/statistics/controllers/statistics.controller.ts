import { reportFilterSchema } from '../../reports/index.js';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import {
  ValidatedBody,
  ValidatedQuery,
} from '../../../common/validated-input.js';
import { Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { IsIn } from 'class-validator';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { ReportFiltersDto } from '../../reports/index.js';
import { StatisticsService } from '../services/statistics.service.js';
/** Контракт StatisticsExportDto: типы заданы явно для watch и собранного приложения. */
export class StatisticsExportDto extends ReportFiltersDto {
  @ApiProperty({
    description: 'Формат результирующего файла.',
    type: String,
    enum: ['png', 'pdf'],
  })
  @IsIn(['png', 'pdf'])
  format!: 'png' | 'pdf';
}
@ApiTags('statistics')
@ApiBearerAuth()
@RequirePermission('statistics.read')
@Controller('api/statistics')
/** Контракт StatisticsController: типы заданы явно для watch и собранного приложения. */
export class StatisticsController {
  constructor(
    @Inject(StatisticsService) private readonly service: StatisticsService,
  ) {}
  @Get()
  @ApiOperation({
    summary: 'Данные трёх графиков',
    description:
      'Требуется вход с ролью CRM. Активные/закрытые проекты и направления используют выборку отчётов. Месячный график учитывает даты создания/закрытия, включает нулевые месяцы, без периода показывает последние 12 месяцев. Максимум 36 месяцев. Область видимости применяется ко всем агрегатам.',
    operationId: 'statistics_get',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
  })
  @ApiOkResponse({
    description:
      'Агрегаты в области видимости; максимум 36 месяцев, без периода — последние 12.',
    schema: {
      required: [
        'generatedAt',
        'timezone',
        'filters',
        'status',
        'directions',
        'months',
      ],
      type: 'object',
      properties: {
        generatedAt: { type: 'string', format: 'date-time' },
        timezone: { type: 'string' },
        filters: reportFilterSchema,
        status: {
          required: ['active', 'closed'],
          type: 'object',
          properties: {
            active: { type: 'integer' },
            closed: { type: 'integer' },
          },
        },
        directions: {
          type: 'array',
          items: {
            required: ['id', 'name', 'count'],
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              count: { type: 'integer' },
            },
          },
        },
        months: {
          type: 'array',
          items: {
            required: ['month', 'created', 'closed'],
            type: 'object',
            properties: {
              month: { type: 'string', example: '2026-09' },
              created: { type: 'integer' },
              closed: { type: 'integer' },
            },
          },
        },
      },
    },
  })
  get(
    @Req() request: AuthRequest,
    @ValidatedQuery(ReportFiltersDto) filters: ReportFiltersDto,
  ) {
    return this.service.get(currentUser(request), filters);
  }
  @Post('exports')
  @ApiOperation({
    summary: 'Заказать PNG/PDF графиков',
    description:
      'Требуется вход с ролью CRM. Фоновая выгрузка по тем же фильтрам. 202 возвращает id для /api/jobs/{id}; готовый файл скачивается через /api/jobs/{id}/file.',
    operationId: 'statistics_create',
  })
  @ApiErrors(
    {
      ...authenticationErrors,
      400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
      429: 'Превышен лимит одновременных операций или сохранённых заданий.',
    },
    { 429: 'EXPORT_LIMIT_REACHED' },
  )
  @HttpCode(202)
  @ApiAcceptedResponse({
    schema: {
      required: ['id', 'status'],
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['QUEUED'], example: 'QUEUED' },
      },
    },
  })
  create(
    @Req() request: AuthRequest,
    @ValidatedBody(StatisticsExportDto) body: StatisticsExportDto,
  ) {
    return this.service.create(currentUser(request), body);
  }
}

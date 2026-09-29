import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { ValidatedBody } from '../../../common/validated-input.js';
import { Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { ExportRequestDto } from '../dto/export-request.dto.js';
import { ReportExportService } from '../services/report-export.service.js';
@ApiTags('reports')
@ApiBearerAuth()
@Controller('api/reports/exports')
export class ReportExportsController {
  constructor(
    @Inject(ReportExportService) private readonly reports: ReportExportService,
  ) {}
  @Post()
  @ApiOperation({
    summary: 'Заказать выгрузку отчёта',
    description:
      'Право: reports.export. 202 возвращает id задания. Для сводки передайте фильтры; для полного отчёта — projectId без фильтров. Форматы xls (BIFF8), xlsx, pdf и json. columns определяет порядок колонок. Опрашивайте /api/jobs/{id}, затем скачайте /file; хранение по умолчанию 24 часа, права и видимость проверяются повторно.',
    operationId: 'report_exports_create',
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
  @RequirePermission('reports.export')
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
    @ValidatedBody(ExportRequestDto, {
      examples: {
        summary: {
          summary: 'Сводка за период в XLSX',
          value: {
            format: 'xlsx',
            dateFrom: '2026-01-01',
            dateTo: '2026-03-31',
            columns: [
              'university',
              'direction',
              'offering',
              'status',
              'responsible',
            ],
          },
        },
        project: {
          summary: 'Полный отчёт проекта в PDF',
          value: {
            format: 'pdf',
            projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        },
      },
    })
    body: ExportRequestDto,
  ) {
    return this.reports.create(currentUser(request), body);
  }
}

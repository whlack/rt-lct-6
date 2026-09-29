import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { UuidParam, ValidatedQuery } from '../../../common/validated-input.js';
import { Controller, Get, Inject, Req } from '@nestjs/common';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { ReportQueryDto } from '../dto/report-query.dto.js';
import { ReportService } from '../services/report.service.js';
import { listSchema, detailSchema } from '../dto/report-response.js';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('api/reports/projects')
export class ReportsController {
  constructor(@Inject(ReportService) private readonly reports: ReportService) {}
  @Get()
  @ApiOperation({
    summary: 'Сводка проектов',
    description:
      'Право: reports.read. dateFrom/dateTo задаются вместе; даты включительны в REPORT_TIMEZONE (Europe/Moscow по умолчанию). Период выбирает проекты хотя бы с одним событием истории, поля показываются текущие. programId и productId взаимоисключающие. Сортировка createdAt DESC, id ASC; pageSize ≤100.',
    operationId: 'reports_list',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
  })
  @ApiOkResponse({ schema: listSchema })
  @RequirePermission('reports.read')
  list(
    @Req() request: AuthRequest,
    @ValidatedQuery(ReportQueryDto) query: ReportQueryDto,
  ) {
    return this.reports.list(currentUser(request), query);
  }
  @Get(':id')
  @ApiOperation({
    summary: 'Полный отчёт проекта',
    description:
      'Право: reports.read. Без ограничения периода: текущие поля, этапы и требования, метаданные файлов, комментарии с ответами и вся хронология. Удалённый текст и ключи S3 не выдаются; содержимое файлов не встраивается.',
    operationId: 'reports_detail',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @ApiOkResponse({ schema: detailSchema })
  @RequirePermission('reports.read')
  detail(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.reports.detail(currentUser(request), id);
  }
}

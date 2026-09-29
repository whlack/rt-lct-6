import { UuidParam, ValidatedQuery } from '../../../common/validated-input.js';
import { Controller, Get, Inject, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
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
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiBadRequestResponse()
@Controller('api/reports/projects')
export class ReportsController {
  constructor(@Inject(ReportService) private readonly reports: ReportService) {}
  @Get()
  @ApiOkResponse({ schema: listSchema })
  @RequirePermission('reports.read')
  @ApiOperation({
    summary:
      'Current project summary; period selects projects with events in the inclusive local date range',
  })
  list(
    @Req() request: AuthRequest,
    @ValidatedQuery(ReportQueryDto) query: ReportQueryDto,
  ) {
    return this.reports.list(currentUser(request), query);
  }
  @Get(':id')
  @ApiOkResponse({ schema: detailSchema })
  @ApiNotFoundResponse({ description: 'Project is unavailable' })
  @RequirePermission('reports.read')
  @ApiOperation({
    summary:
      'Full project report, including history, comments and file metadata',
  })
  detail(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.reports.detail(currentUser(request), id);
  }
}

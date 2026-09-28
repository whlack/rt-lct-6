import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { ExportRequestDto } from '../dto/export-request.dto.js';
import { ReportExportService } from '../services/report-export.service.js';
@ApiTags('reports')
@ApiBearerAuth()
@ApiBadRequestResponse()
@ApiForbiddenResponse()
@Controller('api/reports/exports')
export class ReportExportsController {
  constructor(
    @Inject(ReportExportService) private readonly reports: ReportExportService,
  ) {}
  @Post()
  @HttpCode(202)
  @RequirePermission('reports.export')
  @ApiAcceptedResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'QUEUED' },
      },
    },
  })
  create(@Req() request: AuthRequest, @Body() body: ExportRequestDto) {
    return this.reports.create(currentUser(request), body);
  }
}

import {
  ValidatedBody,
  ValidatedQuery,
} from '../../../common/validated-input.js';
import { Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { ReportFiltersDto } from '../../reports/index.js';
import { StatisticsService } from '../services/statistics.service.js';
export class StatisticsExportDto extends ReportFiltersDto {
  @ApiProperty({ type: String, enum: ['png', 'pdf'] })
  @IsIn(['png', 'pdf'])
  format!: 'png' | 'pdf';
}
@ApiTags('statistics')
@ApiBearerAuth()
@RequirePermission('statistics.read')
@Controller('api/statistics')
export class StatisticsController {
  constructor(
    @Inject(StatisticsService) private readonly service: StatisticsService,
  ) {}
  @Get()
  @ApiOkResponse({
    description:
      'Scoped aggregates; monthly range <=36 months, defaults to last 12',
    schema: {
      type: 'object',
      properties: {
        generatedAt: { type: 'string', format: 'date-time' },
        timezone: { type: 'string' },
        filters: { type: 'object' },
        status: {
          type: 'object',
          properties: {
            active: { type: 'integer' },
            closed: { type: 'integer' },
          },
        },
        directions: {
          type: 'array',
          items: {
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
  @HttpCode(202)
  @ApiAcceptedResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'QUEUED' },
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

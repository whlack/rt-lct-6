import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { Controller, ForbiddenException, Get, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { currentUser, type AuthRequest } from '../../auth/index.js';
import { metrics } from '../../../common/metrics.js';
@ApiTags('operations')
@ApiBearerAuth()
@Controller('api/metrics')
export class MetricsController {
  @ApiProduces('text/plain; version=0.0.4; charset=utf-8')
  @ApiOkResponse({
    description: 'Метрики Prometheus.',
    content: {
      'text/plain; version=0.0.4; charset=utf-8': {
        schema: {
          type: 'string',
          example:
            '# HELP crm_api_duration_seconds API duration\n# TYPE crm_api_duration_seconds histogram\n',
        },
      },
    },
  })
  @Get()
  @ApiOperation({
    summary: 'Метрики Prometheus',
    description:
      'Требуется вход с ролью CRM. Только администратор (уровень 30). Текстовый формат Prometheus; персональные значения, SQL-тексты и токены не включаются.',
    operationId: 'metrics_get',
  })
  @ApiErrors({ ...authenticationErrors })
  async get(@Req() request: AuthRequest, @Res() response: Response) {
    if (currentUser(request).level !== 30)
      throw new ForbiddenException('Administrator required');
    response.type(metrics.contentType).send(await metrics.metrics());
  }
}

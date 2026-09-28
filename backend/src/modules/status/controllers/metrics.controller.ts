import { Controller, ForbiddenException, Get, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { currentUser, type AuthRequest } from '../../auth/index.js';
import { metrics } from '../../../common/metrics.js';
@ApiTags('operations')
@ApiBearerAuth()
@Controller('api/metrics')
export class MetricsController {
  @Get()
  @ApiOperation({ summary: 'Prometheus metrics; administrator only' })
  async get(@Req() request: AuthRequest, @Res() response: Response) {
    if (currentUser(request).level !== 30)
      throw new ForbiddenException('Administrator required');
    response.type(metrics.contentType).send(await metrics.metrics());
  }
}

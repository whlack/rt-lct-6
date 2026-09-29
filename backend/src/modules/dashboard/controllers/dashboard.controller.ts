import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { dashboardSchema } from '../dto/dashboard-response.schema.js';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { Controller, Get, Inject, Req } from '@nestjs/common';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { DashboardService } from '../services/dashboard.service.js';
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('api/dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}
  @Get()
  @ApiOkResponse({ schema: dashboardSchema })
  @ApiOperation({
    summary: 'Показатели главной',
    description:
      'Право: dashboard.read. Согласованный SQL-снимок в области видимости: все доступные вузы, проекты с closedAt=null и открытые проекты с expectedActor=KAM на текущем этапе. Личное назначение дополнительным условием не является.',
    operationId: 'dashboard_get',
  })
  @ApiErrors({ ...authenticationErrors })
  @RequirePermission('dashboard.read')
  get(@Req() request: AuthRequest) {
    return this.dashboard.get(currentUser(request));
  }
}

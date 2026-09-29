import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @RequirePermission('dashboard.read')
  @ApiOperation({
    summary:
      'Visible universities, open projects and open projects expecting a KAM',
  })
  get(@Req() request: AuthRequest) {
    return this.dashboard.get(currentUser(request));
  }
}

import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth.types.js';
import { PermissionService } from '../../permissions/services/permission.service.js';
import { currentUser } from '../auth.types.js';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('api/me')
export class MeController {
  constructor(
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}

  @Get()
  async get(@Req() request: AuthRequest) {
    const user = currentUser(request);
    return { ...user, permissions: await this.permissions.effectiveKeys(user) };
  }
}

import { ValidatedBody } from '../../../common/validated-input.js';
import { Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators/permissions.decorator.js';
import { UpdatePermissionDto } from '../dto/update-permission.dto.js';
import { PermissionService } from '../services/permission.service.js';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('api/permissions')
@RequirePermission('permissions.manage')
export class PermissionsController {
  constructor(
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}

  @Get()
  list() {
    return this.permissions.list();
  }

  @Patch(':key')
  update(
    @Param('key') key: string,
    @ValidatedBody(UpdatePermissionDto) body: UpdatePermissionDto,
  ) {
    return this.permissions.update(key, body.minimumLevel);
  }
}

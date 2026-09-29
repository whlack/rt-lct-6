import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { permissionSchema } from '../dto/permission-response.schema.js';
import { array } from '../../../common/api-schema.js';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { ValidatedBody } from '../../../common/validated-input.js';
import { Controller, Get, Inject, Param, Patch } from '@nestjs/common';
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
  @ApiOkResponse({ schema: array(permissionSchema) })
  @ApiOperation({
    summary: 'Список прав и минимальных уровней',
    description:
      'Право: permissions.manage. Только администратор. Сортировка ключей по возрастанию. Уровни 10/20/30; начальные уровни seed не перезаписывает.',
    operationId: 'permissions_list',
  })
  @ApiErrors({ ...authenticationErrors })
  list() {
    return this.permissions.list();
  }

  @ApiParam({
    name: 'key',
    type: String,
    description: 'Ключ существующего права.',
    example: 'projects.read',
  })
  @Patch(':key')
  @ApiOkResponse({ schema: permissionSchema })
  @ApiOperation({
    summary: 'Изменить минимальный уровень права',
    description:
      'Право: permissions.manage. Только администратор. permissions.manage и visibility.manage нельзя понизить ниже 30.',
    operationId: 'permissions_update',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  update(
    @Param('key') key: string,
    @ValidatedBody(UpdatePermissionDto) body: UpdatePermissionDto,
  ) {
    return this.permissions.update(key, body.minimumLevel);
  }
}

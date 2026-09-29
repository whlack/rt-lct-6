import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { meSchema } from '../dto/auth-response.schema.js';
import { ApiErrors } from '../../../common/api-errors.js';
import { Controller, Get, Inject, Req } from '@nestjs/common';
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
  @ApiOkResponse({ schema: meSchema })
  @ApiOperation({
    summary: 'Текущий пользователь и права',
    description:
      'Требуется вход с ролью CRM. Возвращает локальный id, subject Keycloak, уровень роли, эффективные ключи прав и политику видимости. name учитывает локальное переопределение ФИО; email/name могут отсутствовать.',
    operationId: 'auth_me_get',
  })
  @ApiErrors({
    401: 'Токен отсутствует, недействителен или не содержит роли CRM.',
    500: 'Внутренняя ошибка сервера или недоступность БД.',
  })
  async get(@Req() request: AuthRequest) {
    const user = currentUser(request);
    return { ...user, permissions: await this.permissions.effectiveKeys(user) };
  }
}

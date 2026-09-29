import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { Controller, Get, Inject, Put, Req } from '@nestjs/common';
import { UuidParam, ValidatedBody } from '../../../common/validated-input.js';
import { currentUser, type AuthRequest } from '../auth.types.js';
import { RequirePermission } from '../decorators/permissions.decorator.js';
import { VisibilityDto } from '../dto/visibility.dto.js';
import { VisibilityService } from '../services/visibility.service.js';

@ApiTags('visibility')
@ApiBearerAuth()
@RequirePermission('visibility.manage')
@Controller('api/visibility')
export class VisibilityController {
  constructor(
    @Inject(VisibilityService) private readonly visibility: VisibilityService,
  ) {}
  @Get(':subject')
  @ApiOperation({
    summary: 'Прочитать политику видимости КАМ',
    description:
      'Право: visibility.manage. Только администратор. subject — активный КАМ Keycloak. ASSIGNED использует назначения, ALL открывает все объекты, SELECTED — явные списки; Выбранный вуз открывает все его проекты. Отдельный выбранный проект не открывает карточку вуза и остальные проекты.',
    operationId: 'auth_visibility_get',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @ApiOkResponse({ type: VisibilityDto })
  get(@Req() request: AuthRequest, @UuidParam('subject') subject: string) {
    return this.visibility.get(currentUser(request), subject);
  }
  @Put(':subject')
  @ApiOperation({
    summary: 'Заменить политику видимости КАМ',
    description:
      'Право: visibility.manage. Только администратор. Передаётся полная политика; отсутствующие списки становятся пустыми. Явные списки разрешены только в SELECTED. Идентификаторы должны существовать.',
    operationId: 'auth_visibility_set',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @ApiOkResponse({ type: VisibilityDto })
  set(
    @Req() request: AuthRequest,
    @UuidParam('subject') subject: string,
    @ValidatedBody(VisibilityDto, {
      examples: {
        assigned: {
          summary: 'Доступ по назначениям',
          value: { mode: 'ASSIGNED' },
        },
        selected: {
          summary: 'Все проекты выбранного вуза',
          value: {
            mode: 'SELECTED',
            universityIds: ['22222222-2222-4222-8222-222222222222'],
            projectIds: [],
          },
        },
        all: { summary: 'Все предметные данные', value: { mode: 'ALL' } },
      },
    })
    body: VisibilityDto,
  ) {
    return this.visibility.set(currentUser(request), subject, body);
  }
}

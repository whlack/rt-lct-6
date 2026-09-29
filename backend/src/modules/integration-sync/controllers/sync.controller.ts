import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { UuidParam, ValidatedQuery } from '../../../common/validated-input.js';
import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Inject,
  HttpCode,
} from '@nestjs/common';
import {
  RequirePermission,
  currentUser,
  type AuthRequest,
} from '../../auth/index.js';
import { SyncService } from '../services/sync.service.js';
import {
  SyncPageDto,
  SyncStateDto,
  SyncRunDto,
  SyncStartDto,
  SyncHistoryDto,
} from '../dto/sync.dto.js';
@ApiTags('integrations')
@ApiBearerAuth()
@Controller('api/integrations')
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}
  @Get()
  @ApiOperation({
    summary: 'Состояние LMS и сайта',
    description:
      'Право: integrations.manage. Оба источника сейчас NOT_IMPLEMENTED, reason=SOURCE_NOT_IMPLEMENTED, nextRunAt=null. Интервал по умолчанию 3600 секунд. Реальный обмен не реализован.',
    operationId: 'integration_sync_states',
  })
  @ApiErrors({ ...authenticationErrors })
  @RequirePermission('integrations.manage')
  @ApiOkResponse({ type: SyncStateDto, isArray: true })
  states() {
    return this.sync.states();
  }
  @Post(':source/sync')
  @ApiOperation({
    summary: 'Запросить синхронизацию источника',
    description:
      'Право: integrations.sync. Сейчас всегда 409 SOURCE_NOT_IMPLEMENTED без создания задания. Для будущего готового адаптера — 202 runId; при активном запуске — 409 SYNC_ALREADY_ACTIVE.',
    operationId: 'integration_sync_start',
  })
  @ApiErrors({
    ...authenticationErrors,
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @HttpCode(202)
  @RequirePermission('integrations.sync')
  @ApiParam({ name: 'source', enum: ['LMS', 'WEBSITE'] })
  @ApiAcceptedResponse({ type: SyncStartDto })
  @ApiConflictResponse({
    schema: {
      type: 'object',
      required: ['statusCode', 'message', 'error'],
      properties: {
        statusCode: { type: 'integer', enum: [409] },
        message: {
          type: 'string',
          enum: ['SOURCE_NOT_IMPLEMENTED', 'SYNC_ALREADY_ACTIVE'],
        },
        error: { type: 'string', enum: ['Conflict'] },
      },
      example: {
        statusCode: 409,
        message: 'SOURCE_NOT_IMPLEMENTED',
        error: 'Conflict',
      },
    },
    description:
      'SOURCE_NOT_IMPLEMENTED — адаптер не реализован; SYNC_ALREADY_ACTIVE — источник занят. Новое задание не создаётся.',
  })
  start(@Param('source') source: string, @Req() request: AuthRequest) {
    return this.sync.start(source, currentUser(request));
  }
  @Get(':source/runs')
  @ApiOperation({
    summary: 'История синхронизаций источника',
    description:
      'Право: integrations.manage. Доступ пользователям с integrations.manage. createdAt DESC, id DESC; страница до 100 записей. История содержит только идентификатор инициатора, без профиля и внешних данных.',
    operationId: 'integration_sync_list',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('integrations.manage')
  @ApiParam({ name: 'source', enum: ['LMS', 'WEBSITE'] })
  @ApiOkResponse({ type: SyncHistoryDto })
  // Явный DTO сохраняет валидацию и OpenAPI при tsx watch без design:paramtypes.
  list(
    @Param('source') source: string,
    @ValidatedQuery(SyncPageDto)
    query: SyncPageDto,
  ) {
    return this.sync.list(source, query);
  }
  @Get(':source/runs/:id')
  @ApiOperation({
    summary: 'Состояние запуска синхронизации',
    description:
      'Право: integrations.manage. Статус, способ запуска, времена, число начатых попыток и безопасный код ошибки. Идентификатор должен принадлежать указанному источнику.',
    operationId: 'integration_sync_get',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('integrations.manage')
  @ApiParam({ name: 'source', enum: ['LMS', 'WEBSITE'] })
  @ApiOkResponse({ type: SyncRunDto })
  get(@Param('source') source: string, @UuidParam('id') id: string) {
    return this.sync.get(source, id);
  }
}

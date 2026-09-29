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
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiParam,
} from '@nestjs/swagger';
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
@ApiUnauthorizedResponse({ description: 'Bearer token required' })
@ApiForbiddenResponse({ description: 'Permission required' })
@ApiBadRequestResponse({ description: 'Invalid UUID or pagination' })
@ApiNotFoundResponse({ description: 'SOURCE_NOT_FOUND or SYNC_RUN_NOT_FOUND' })
@Controller('api/integrations')
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}
  @Get()
  @RequirePermission('integrations.manage')
  @ApiOkResponse({ type: SyncStateDto, isArray: true })
  states() {
    return this.sync.states();
  }
  @Post(':source/sync')
  @HttpCode(202)
  @RequirePermission('integrations.sync')
  @ApiParam({ name: 'source', enum: ['LMS', 'WEBSITE'] })
  @ApiAcceptedResponse({ type: SyncStartDto })
  @ApiConflictResponse({
    schema: {
      example: {
        statusCode: 409,
        message: 'SOURCE_NOT_IMPLEMENTED',
        error: 'Conflict',
      },
    },
    description:
      'SOURCE_NOT_IMPLEMENTED or SYNC_ALREADY_ACTIVE; no run created',
  })
  start(@Param('source') source: string, @Req() request: AuthRequest) {
    return this.sync.start(source, currentUser(request));
  }
  @Get(':source/runs')
  @RequirePermission('integrations.manage')
  @ApiParam({ name: 'source', enum: ['LMS', 'WEBSITE'] })
  @ApiOkResponse({ type: SyncHistoryDto })
  // Local tsx watch does not emit parameter type metadata; use the same validated DTO in both modes.
  list(
    @Param('source') source: string,
    @ValidatedQuery(SyncPageDto)
    query: SyncPageDto,
  ) {
    return this.sync.list(source, query);
  }
  @Get(':source/runs/:id')
  @RequirePermission('integrations.manage')
  @ApiParam({ name: 'source', enum: ['LMS', 'WEBSITE'] })
  @ApiOkResponse({ type: SyncRunDto })
  get(@Param('source') source: string, @UuidParam('id') id: string) {
    return this.sync.get(source, id);
  }
}

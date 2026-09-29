import { Controller, Get, Inject, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({ type: VisibilityDto })
  get(@Req() request: AuthRequest, @UuidParam('subject') subject: string) {
    return this.visibility.get(currentUser(request), subject);
  }
  @Put(':subject')
  @ApiOkResponse({ type: VisibilityDto })
  set(
    @Req() request: AuthRequest,
    @UuidParam('subject') subject: string,
    @ValidatedBody(VisibilityDto) body: VisibilityDto,
  ) {
    return this.visibility.set(currentUser(request), subject, body);
  }
}

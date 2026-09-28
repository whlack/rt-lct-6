import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Req,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { currentUser, type AuthRequest } from '../../auth/index.js';
import { JobsService } from '../services/jobs.service.js';
@ApiTags('jobs')
@ApiBearerAuth()
@ApiForbiddenResponse()
@ApiNotFoundResponse()
@Controller('api/jobs')
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}
  @Get(':id')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        kind: { type: 'string', enum: ['export', 'import'] },
        status: {
          type: 'string',
          enum: [
            'QUEUED',
            'RUNNING',
            'PREVIEW',
            'SUCCEEDED',
            'FAILED',
            'EXPIRED',
          ],
        },
        progress: { type: 'integer' },
        errorCode: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        startedAt: { type: 'string', nullable: true },
        completedAt: { type: 'string', nullable: true },
        expiresAt: { type: 'string', nullable: true },
      },
    },
  })
  get(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.get(currentUser(request), id);
  }
  @Get(':id/file')
  @ApiConflictResponse()
  @ApiGoneResponse()
  @ApiOkResponse({
    description:
      'Binary result; current owner permissions and project visibility are rechecked',
    schema: { type: 'string', format: 'binary' },
  })
  async file(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.jobs.file(currentUser(request), id);
    return new StreamableFile(result.bytes, {
      type: result.mimeType,
      disposition:
        "attachment; filename*=UTF-8''" + encodeURIComponent(result.fileName),
      length: result.bytes.length,
    });
  }
}

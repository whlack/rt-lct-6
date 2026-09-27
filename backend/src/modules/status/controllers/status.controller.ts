import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StatusService } from '../services/status.service.js';
import { Public } from '../../auth/decorators/public.decorator.js';

@ApiTags('status')
@Controller('api')
export class StatusController {
  constructor(@Inject(StatusService) private readonly status: StatusService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Process liveness' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  health(): { status: 'ok' } {
    return this.status.health();
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Database readiness' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable' })
  async ready(): Promise<{ status: 'ok' }> {
    const result = await this.status.ready();
    if (result.status !== 'ok') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status: 'ok' };
  }
}
